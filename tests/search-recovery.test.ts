import test from 'node:test'
import assert from 'node:assert/strict'
import { recoverSearchFields } from '../src/shared/search-recovery.ts'
import { parseZhihuResponse } from '../src/shared/zhihu.ts'

const row = { ContentID: '1', Url: 'https://example.com/article', EditTime: 1700000000, Summary: '原始摘要', Title: '原始标题' }
const raw = { Code: 0, Data: { Items: [row] } }

test('model can select an existing text field, preserves originals and passes validation', async () => {
  let calls = 0
  const candidate = await recoverSearchFields(raw, async (prompt) => {
    calls++
    assert.ok(prompt.includes('Summary'))
    assert.ok(!prompt.includes('原始摘要'))
    return '{"ContentText":"Summary","Title":"Summary"}'
  })
  const parsed = parseZhihuResponse(candidate).items[0]
  assert.equal(calls, 1)
  assert.equal(parsed.ContentText, row.Summary)
  assert.equal(parsed.Title, row.Title)
  assert.equal(parsed.Url, row.Url)
  assert.equal(parsed.EditTime, row.EditTime)
  assert.equal(parsed.ContentType, 'Unknown')
  assert.equal('ContentText' in row, false)
})

test('model cannot change provenance, invent text, or bypass schema validation', async () => {
  await assert.rejects(recoverSearchFields(raw, async () => '{"Url":"Summary"}'))
  const candidate = await recoverSearchFields(raw, async () => '{"ContentText":"杜撰正文"}')
  assert.throws(() => parseZhihuResponse(candidate), /ContentText/)
  await assert.rejects(recoverSearchFields(raw, async () => 'invalid JSON'))
})

test('business errors and missing essential evidence never trigger model repair', async () => {
  let calls = 0
  for (const input of [
    { Code: 30001, Data: null },
    { Code: 0, Data: { Items: [{ ...row, Url: null }] } },
    { Code: 0, Data: { Items: [{ ...row, ContentText: '有效正文' }] } },
  ]) {
    assert.equal(await recoverSearchFields(input, async () => { calls++; return '{}' }), input)
  }
  assert.equal(calls, 0)
})
