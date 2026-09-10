import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseZhihuResponse } from '../src/shared/zhihu.ts'
const item = {
  ContentID: '-2078986536204784617',
  ContentType: 'Answer',
  Title: '标题',
  ContentText: '摘要',
  Url: 'https://www.zhihu.com/answer/123',
  EditTime: 1700000000,
  VoteUpCount: 10,
  AuthorName: '作者',
}
test('business errors with Data:null keep the real error code', () => {
  for (const code of [10001, 20001, 30001, 90001, 40001])
    assert.throws(
      () => parseZhihuResponse({ Code: code, Data: null }),
      new RegExp(`Code ${code}`),
    )
})

test('missing content type does not discard usable evidence', () => {
  for (const ContentType of [undefined, null, '', '   ']) {
    const result = parseZhihuResponse({ Code: 0, Data: { Items: [{ ...item, ContentType }] } })
    assert.equal(result.items[0].ContentType, 'Unknown')
    assert.equal(result.items[0].ContentText, item.ContentText)
  }
})
test('nullable optional fields and numeric strings are normalized, long IDs stay exact', () => {
  const result = parseZhihuResponse({
    Code: '0',
    Data: {
      Items: [
        {
          ...item,
          Title: null,
          AuthorName: null,
          VoteUpCount: null,
          EditTime: '1700000000',
        },
      ],
    },
  })
  assert.equal(result.items[0].ContentID, item.ContentID)
  assert.equal(result.items[0].AuthorName, '')
  assert.equal(result.items[0].VoteUpCount, 0)
  assert.equal(result.items[0].EditTime, 1700000000)
})
test('missing or invalid success data is not silently treated as zero search results', () => {
  for (const Data of [null, {}, { Items: {} }, { Items: null }])
    assert.throws(() => parseZhihuResponse({ Code: 0, Data }))
  assert.equal(
    parseZhihuResponse({ Code: 0, Data: { Items: [] } }).items.length,
    0,
  )
  assert.equal(
    parseZhihuResponse({
      Code: 0,
      Data: { Items: null, EmptyReason: '无相关内容' },
    }).items.length,
    0,
  )
})
test('one malformed item does not discard valid samples, but creates a visible warning', () => {
  const result = parseZhihuResponse({
    Code: 0,
    Data: { Items: [item, { ...item, ContentText: null }] },
  })
  assert.equal(result.items.length, 1)
  assert.equal(result.warnings.length, 1)
  assert.equal(result.rawCount, 2)
  assert.throws(
    () =>
      parseZhihuResponse({
        Code: 0,
        Data: { Items: [{ ...item, ContentID: Number.MAX_SAFE_INTEGER + 1 }] },
      }),
    /ContentID/,
  )
})
