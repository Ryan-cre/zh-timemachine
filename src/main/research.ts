import { z } from 'zod'
import type { Research, Provider } from '../shared/types'
import { cleanOpinions } from '../shared/logic'
import { saveResearch } from './store'
import { search, ask, parseJSON } from './adapters'

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
  try {
    r.status = 'running'
    progress('正在规划检索词')
    if (!r.queries.length) {
      const plan = await ask(
        p,
        `针对研究问题生成最多两个中性知乎检索关键词，避免只搜索赞同或反对一方。返回 {"queries":["关键词"]}。问题：${JSON.stringify(r.input.question)}`,
        signal,
        700,
      )
      r.tokens += plan.tokens
      try {
        r.queries = [
          ...new Set([
            r.input.question,
            ...planSchema.parse(parseJSON(plan.text)).queries,
          ]),
        ].slice(0, 3)
      } catch {
        r.queries = [r.input.question]
      }
    }
    for (const period of r.periods) {
      check()
      if (period.status === 'done') continue
      // Reserve one search per remaining period; extra query expansions use only spare budget.
      if (!period.evidence.length) {
        const remaining = r.periods.filter((x) => x.status !== 'done').length
        const count = Math.min(
          r.queries.length,
          Math.floor((r.input.maxSearches - r.searches) / remaining),
        )
        if (count < 1)
          throw new Error('搜索次数上限已用尽；请新建研究并提高上限')
        const seen = new Set<string>()
        for (const query of r.queries.slice(0, count)) {
          check()
          progress(`正在搜索 ${period.label} · ${query}`)
          r.searches += 1
          saveResearch(r)
          const result = await search(query, period.from, period.to, signal)
          period.saturated ||= result.saturated
          for (const item of result.items)
            if (!seen.has(item.id)) {
              seen.add(item.id)
              period.evidence.push(item)
            }
        }
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
      const response = await ask(
        p,
        `研究问题：${JSON.stringify(r.input.question)}。时间段：${period.label}。按主要立场归类，每条证据最多归入一个观点。尽量沿用已有标签 ${JSON.stringify(known)}，确实出现新观点时再新增。不能判断的样本归为“无法判断”。只依据摘要，不把当前赞同数当作历史热度。返回 {"summary":"阶段概括","opinions":[{"label":"简短观点","summary":"解释","evidenceIds":["精确ID"]}]}。样本：${JSON.stringify(period.evidence.map((x) => ({ id: x.id, title: x.title, text: x.text.slice(0, 5000) })))}`,
        signal,
      )
      r.tokens += response.tokens
      const analysis = analysisSchema.parse(parseJSON(response.text))
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
      const response = await ask(
        p,
        `请概括以下样本中观点随时间的变化。不要把样本当作全站民意，不对空白时期作推断，不推断同一作者改变观点。返回 {"overview":"约200字中文概括"}。问题：${JSON.stringify(r.input.question)}。阶段：${JSON.stringify(r.periods.map((x) => ({ period: x.label, sampleCount: x.evidence.length, summary: x.summary })))}`,
        signal,
        1500,
      )
      r.tokens += response.tokens
      r.overview = finalSchema.parse(parseJSON(response.text)).overview
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
          ? '模型返回格式无效，可继续分析重试当前阶段'
          : (error as Error).message,
    )
  }
}
