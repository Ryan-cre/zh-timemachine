import type { Evidence, Research } from './types.ts'

function markdownText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}\[\]<>|#])/g, '\\$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function sourceLink(evidence: Evidence): string {
  const title = markdownText(evidence.title || '查看来源')
  const url = evidence.url.replace(/</g, '%3C').replace(/>/g, '%3E')
  return `[${title}](<${url}>)`
}

export function researchToMarkdown(research: Research): string {
  const sampleCount = research.periods.reduce(
    (total, period) => total + period.evidence.length,
    0,
  )
  const lines = [
    `# ${markdownText(research.input.question)}`,
    '',
    `> ZH-Timemachine 观点变化研究报告 · ${research.input.searchSource === 'global' ? '全网搜索' : '知乎搜索'}`,
    '',
    `- 研究范围：${research.input.start} 至 ${research.input.end}`,
    `- 时间粒度：${research.input.grain === 'year' ? '年' : research.input.grain === 'quarter' ? '季度' : '月'}`,
    `- 分析模型：${markdownText(research.model)}`,
    `- 样本数量：${sampleCount} 条`,
    `- 搜索次数：${research.searches} 次`,
    `- 模型用量：${research.tokens.toLocaleString('zh-CN')} tokens`,
    '',
    '## 变化概览',
    '',
    research.overview ? markdownText(research.overview) : '尚未生成跨时期概览。',
    '',
  ]

  for (const period of research.periods) {
    lines.push(`## ${markdownText(period.label)}`, '')
    lines.push(markdownText(period.summary || '本阶段尚未生成概括。'), '')
    if (period.searchQueries?.length) {
      lines.push(
        `检索词：${period.searchQueries.map((query) => `\`${markdownText(query)}\``).join('、')}`,
        '',
      )
    }
    if (period.opinions.length) {
      lines.push('### 主要观点', '')
      for (const opinion of period.opinions) {
        lines.push(
          `- **${markdownText(opinion.label)}**（${opinion.evidenceIds.length} 条证据）：${markdownText(opinion.summary)}`,
        )
      }
      lines.push('')
    }
    if (period.evidence.length) {
      lines.push('### 证据来源', '')
      for (const evidence of period.evidence) {
        const date = new Date(evidence.time * 1000).toLocaleDateString('zh-CN', {
          timeZone: 'Asia/Shanghai',
        })
        lines.push(
          `- ${sourceLink(evidence)} · ${markdownText(evidence.author || '匿名作者')} · ${date} · ${evidence.votes} 赞同（采集时）`,
        )
      }
      lines.push('')
    }
    for (const warning of period.warnings ?? [])
      lines.push(`> 样本提示：${markdownText(warning)}`, '')
  }

  lines.push(
    '---',
    '',
    '本报告依据检索到的样本摘要生成，不代表平台或全网民意，也不能据此还原历史版本。观点分类和概括应结合原始来源复核。',
    '',
  )
  return lines.join('\n')
}
