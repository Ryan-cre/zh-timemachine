import { z } from 'zod'
import type { Research, Provider } from '../shared/types'
import { cleanOpinions } from '../shared/logic'
import { saveResearch } from './store'
import { search, ask } from './adapters'
import { structuredRequest, ModelFormatError } from '../shared/structured'

const planSchema = z.object({
  queries: z.array(z.string().min(1).max(120)).min(1).max(3),
})
const analysisSchema = z.object({
  summary: z.string().max(2500),
  opinions: z
    .array(
      z.object({
        label: z.string().min(1).max(40),
        summary: z.string().max(1200),
        evidenceIds: z.array(z.string()),
      }),
    )
    .max(8),
})
const finalSchema = z.object({ overview: z.string().max(4000) })
export async function runResearch(
  r: Research,
  p: Provider,
  signal: AbortSignal,
  changed: () => void,
) {
  const progress = (message: string) => {
    r.message = message
    saveResearch(r)
    changed()
  }
  const check = () => {
    if (signal.aborted) throw new Error('任务已取消')
  }
  const generate = <T>(
    schema: z.ZodType<T>,
    prompt: string,
    maxTokens: number,
    stage: string,
  ) =>
    structuredRequest({
      schema,
      prompt,
      maxTokens,
      stage,
      signal,
      request: (text, limit) => ask(p, text, signal, limit),
      onReply: (reply) => {
        r.tokens += reply.tokens
        saveResearch(r)
      },
      onRetry: (reason) => progress(`${stage}：${reason}，正在自动纠正…`),
    })
  try {
    r.status = 'running'
    progress('正在规划检索词')
    if (!r.queries.length) {
      try {
        const plan = await generate(
          planSchema,
          `针对研究问题生成最多两个中性${r.input.searchSource === 'global' ? '全网' : '知乎'}检索关键词，每个1—120字。返回 {"queries":["关键词"]}。问题：${JSON.stringify(r.input.question)}`,
          700,
          '检索规划',
        )
        r.queries = [...new Set([r.input.question, ...plan.queries])].slice(
          0,
          3,
        )
      } catch (error) {
        if (!(error instanceof ModelFormatError)) throw error
        r.queries = [r.input.question]
      }
    }

    for (const period of r.periods) {
      check()
      if (period.status === 'done') continue
      // Reserve one search per remaining period; extra query expansions use only spare budget.
      if (!period.searchComplete && !(period.searchQueries === undefined && period.evidence.length)) {
        if (!period.searchQueries) {
          const remaining = r.periods.filter((x) => x.status !== 'done').length
          const count = Math.min(
            r.queries.length,
            Math.floor((r.input.maxSearches - r.searches) / remaining),
          )
          if (count < 1)
            throw new Error('搜索次数上限已用尽；请新建研究并提高上限')
          period.searchQueries = r.queries.slice(0, count)
          period.completedQueries = []
          saveResearch(r)
        }
        const seen = new Set(period.evidence.map((item) => item.id))
        for (const query of period.searchQueries) {
          if (period.completedQueries?.includes(query)) continue
          check()
          if (r.searches >= r.input.maxSearches)
            throw new Error('搜索次数上限已用尽；请新建研究并提高上限')
          progress(`正在搜索 ${period.label} · ${query}`)
          const result = await search(query, period.from, period.to, signal, true, () => {
            r.searches += 1
            saveResearch(r)
          }, r.input.searchSource ?? 'zhihu')
          period.saturated ||= result.saturated
          period.warnings = [
            ...new Set([...(period.warnings ?? []), ...result.warnings]),
          ]
          for (const item of result.items)
            if (!seen.has(item.id)) {
              seen.add(item.id)
              period.evidence.push(item)
            }
          period.completedQueries = [...(period.completedQueries ?? []), query]
          saveResearch(r)
        }
        period.searchComplete = true
        saveResearch(r)
      }
      check()
      if (!period.evidence.length) {
        period.summary = '本时间段未检索到可分析的样本。'
        period.status = 'done'
        progress(`${period.label} 暂无样本`)
        continue
      }
      progress(`正在分析 ${period.label} · ${period.evidence.length} 条样本`)
      const known = [
        ...new Set(r.periods.flatMap((x) => x.opinions.map((o) => o.label))),
      ]
      const analysis = await generate(
        analysisSchema,
        `研究问题：${JSON.stringify(r.input.question)}。时间段：${period.label}。按主要立场归类，最多8个观点；label为1—40字，阶段summary不超过2500字，每个观点summary不超过1200字，evidenceIds必须为字符串数组。每条证据最多归入一个观点。尽量沿用已有标签 ${JSON.stringify(known)}，确实出现新观点时再新增。不能判断的样本归为“无法判断”。只依据摘要，不把当前赞同数当作历史热度。返回 {"summary":"阶段概括","opinions":[{"label":"简短观点","summary":"解释","evidenceIds":["精确ID"]}]}。样本：${JSON.stringify(period.evidence.map((x) => ({ id: x.id, title: x.title, text: x.text.slice(0, 5000) })))}`,
        3000,
        `${period.label} 阶段分析`,
      )
      period.summary = analysis.summary
      period.opinions = cleanOpinions(analysis.opinions, period.evidence)
      const assigned = new Set(period.opinions.flatMap((x) => x.evidenceIds))
      const other = period.evidence
        .filter((x) => !assigned.has(x.id))
        .map((x) => x.id)
      if (other.length)
        period.opinions.push({
          label: '未归类',
          summary: '模型未提供有效归类的样本。',
          evidenceIds: other,
        })
      period.status = 'done'
      progress(`${period.label} 分析完成`)
    }
    check()
    progress('正在整理跨时期变化')
    if (r.periods.some((x) => x.evidence.length)) {
      const final = await generate(
        finalSchema,
        `请概括以下样本中观点随时间的变化。不要把样本当作全站民意，不对空白时期作推断，不推断同一作者改变观点。返回 {"overview":"约200字中文概括"}。问题：${JSON.stringify(r.input.question)}。阶段：${JSON.stringify(r.periods.map((x) => ({ period: x.label, sampleCount: x.evidence.length, summary: x.summary })))}`,
        1500,
        '跨时期概括',
      )
      r.overview = final.overview
    } else
      r.overview = '所选时间范围内未检索到足够样本，请尝试调整关键词或日期。'
    check()
    r.status = 'done'
    progress('研究完成')
  } catch (error) {
    r.status = signal.aborted ? 'cancelled' : 'failed'
    progress(
      signal.aborted
        ? '已取消，已完成的阶段已保存'
        : error instanceof z.ZodError || error instanceof SyntaxError
          ? '响应数据异常，样本已保存，可继续分析'
          : (error as Error).message,
    )
  }
}
