import test from 'node:test'
import assert from 'node:assert/strict'
import { researchToMarkdown } from '../src/shared/report.ts'
import type { Research } from '../src/shared/types.ts'

test('Markdown report includes provenance and escapes evidence text', () => {
  const research: Research = {
    id: 'research',
    input: {
      question: 'AI *会* 改变开发吗？',
      start: '2025-01-01',
      end: '2025-12-31',
      grain: 'year',
      providerId: 'provider',
      maxSearches: 3,
      searchSource: 'zhihu',
    },
    createdAt: '2026-09-13T00:00:00.000Z',
    status: 'done',
    message: '研究完成',
    searches: 2,
    tokens: 1200,
    overview: '观点发生变化。',
    queries: ['AI 开发'],
    model: 'model',
    periods: [
      {
        label: '2025',
        from: 1735660800,
        to: 1767196799,
        evidence: [
          {
            id: 'Answer:1',
            title: '来源 [标题]',
            text: '摘要',
            url: 'https://www.zhihu.com/question/1/answer/1',
            time: 1735660800,
            votes: 12,
            author: '作者',
            capturedAt: '2026-09-13T00:00:00.000Z',
          },
        ],
        summary: '阶段总结',
        opinions: [
          { label: '协作', summary: '人机协作', evidenceIds: ['Answer:1'] },
        ],
        status: 'done',
        saturated: false,
        searchQueries: ['AI 开发'],
      },
    ],
  }
  const report = researchToMarkdown(research)
  assert.ok(report.startsWith('# AI \\*会\\* 改变开发吗？'))
  assert.match(report, /\[来源 \\\[标题\\\]\]\(<https:\/\/www\.zhihu\.com\/question\/1\/answer\/1>\)/)
  assert.match(report, /样本数量：1 条/)
  assert.match(report, /不代表平台或全网民意/)
  assert.doesNotMatch(report, /API Key|providerId/)
})
