import test from 'node:test'
import assert from 'node:assert/strict'
import { assertRateReady, rateLimited } from '../src/shared/rate-limit.ts'

test('rate limit backs off, persists through serialization, and allows retry after cooldown', () => {
  const first = rateLimited({ nextAt: 0, retryAt: 0, strikes: 0 }, null, 1000)
  assert.equal(first.retryAt, 61000)
  const restored = JSON.parse(JSON.stringify(first))
  assert.throws(() => assertRateReady(restored, 2000), /冷却剩余 59 秒/)
  assert.doesNotThrow(() => assertRateReady(restored, 61000))
  assert.equal(rateLimited(restored, null, 61000).retryAt, 181000)
})

test('Retry-After seconds and dates are respected, invalid headers use local fallback', () => {
  const state = { nextAt: 0, retryAt: 0, strikes: 0 }
  assert.equal(rateLimited(state, '120', 1000).retryAt, 121000)
  assert.equal(rateLimited(state, 'Thu, 01 Jan 1970 00:02:00 GMT', 1000).retryAt, 120000)
  assert.equal(rateLimited(state, 'invalid', 1000).retryAt, 61000)
  assert.equal(rateLimited({ ...state, strikes: 20 }, null, 1000).retryAt, 901000)
})
