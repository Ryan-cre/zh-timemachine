import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import {
  parseModelJSON,
  structuredRequest,
  ModelFormatError,
} from '../src/shared/structured.ts'
const schema = z.object({ summary: z.string().max(10) })
test('nine viewpoints trigger correction to eight without dropping data locally', async () => {
  const schema = z.object({ opinions: z.array(z.string()).max(8) })
  let calls = 0
  const result = await structuredRequest({
    schema, stage: '2026 阶段分析', prompt: '最多8类', maxTokens: 3000,
    signal: new AbortController().signal,
    request: async prompt => {
      calls++
      if (calls === 2) assert.match(prompt, /opinions.*too_big/)
      return { text: JSON.stringify({ opinions: Array.from({ length: calls === 1 ? 9 : 8 }, (_, i) => `观点${i}`) }), tokens: 10 }
    },
    onReply: () => {}, onRetry: () => {},
  })
  assert.equal(calls, 2)
  assert.equal(result.opinions.length, 8)
})
test('parses fenced JSON and prose without repairing truncated content', () => {
  assert.deepEqual(parseModelJSON('```json\n{"summary":"hi"}\n```'), {
    summary: 'hi',
  })
  assert.deepEqual(parseModelJSON('结果：{"summary":"a } b"} 完毕'), {
    summary: 'a } b',
  })
  assert.throws(() => parseModelJSON('{"summary":"unfinished'))
  assert.throws(() => parseModelJSON('{"a":1} {"b":2}'))
})
test('truncated output doubles budget once and counts both requests', async () => {
  const limits: number[] = [],
    usage: number[] = []
  const result = await structuredRequest({
    schema,
    stage: '阶段',
    prompt: 'sample',
    maxTokens: 3000,
    signal: new AbortController().signal,
    request: async (_prompt, limit) => {
      limits.push(limit)
      return limits.length === 1
        ? { text: '{"summary":', tokens: 3000, finishReason: 'length' }
        : { text: '{"summary":"ok"}', tokens: 20, finishReason: 'stop' }
    },
    onReply: (r) => usage.push(r.tokens),
    onRetry: () => {},
  })
  assert.deepEqual(limits, [3000, 6000])
  assert.deepEqual(usage, [3000, 20])
  assert.equal(result.summary, 'ok')
})
test('schema mismatch is explained to the model; persistent errors are bounded', async () => {
  let calls = 0,
    retryPrompt = ''
  await assert.rejects(
    structuredRequest({
      schema,
      stage: '2026 阶段',
      prompt: 'sample',
      maxTokens: 3000,
      signal: new AbortController().signal,
      request: async (prompt) => {
        calls++
        retryPrompt = prompt
        return { text: '{"summary":42}', tokens: 5, finishReason: 'stop' }
      },
      onReply: () => {},
      onRetry: () => {},
    }),
    ModelFormatError,
  )
  assert.equal(calls, 2)
  assert.match(retryPrompt, /summary/)
})
test('cancel before retry stops further paid calls', async () => {
  const controller = new AbortController()
  let calls = 0
  await assert.rejects(
    structuredRequest({
      schema,
      stage: '阶段',
      prompt: 'sample',
      maxTokens: 3000,
      signal: controller.signal,
      request: async () => {
        calls++
        return { text: '', tokens: 1 }
      },
      onReply: () => {},
      onRetry: () => controller.abort(),
    }),
  )
  assert.equal(calls, 1)
})
