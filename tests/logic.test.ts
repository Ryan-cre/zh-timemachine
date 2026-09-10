import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  makePeriods,
  dayTimestamp,
  validateBaseURL,
  cleanOpinions,
  sourceAllowed,
} from '../src/shared/logic.ts'
test('calendar windows include leap day and have no overlap', () => {
  const periods = makePeriods('2024-02-15', '2024-04-03', 'month')
  assert.equal(periods.length, 3)
  assert.equal(periods[0].to + 1, dayTimestamp('2024-03-01'))
  assert.equal(periods[1].from, periods[0].to + 1)
  assert.equal(periods[2].to, dayTimestamp('2024-04-04') - 1)
})
test('quarter and year transitions, invalid dates and budget bounds', () => {
  assert.deepEqual(
    makePeriods('2023-12-31', '2024-01-01', 'quarter').map((x) => x.label),
    ['2023 Q4', '2024 Q1'],
  )
  assert.equal(
    makePeriods('2024-01-01', '2024-01-01', 'year')[0].to -
      dayTimestamp('2024-01-01'),
    86399,
  )
  assert.throws(() => dayTimestamp('2023-02-29'))
  assert.throws(() => makePeriods('2025-01-01', '2024-01-01', 'month'))
  assert.throws(() => makePeriods('2020-01-01', '2026-01-01', 'month'))
})
test('sources and provider URLs reject dangerous destinations', () => {
  assert.equal(
    sourceAllowed('https://www.zhihu.com/answer/123?utm_source=test'),
    true,
  )
  for (const url of [
    'javascript:alert(1)',
    'https://zhihu.com.evil.test/',
    'file:///etc/passwd',
    'https://user:pass@zhihu.com',
  ])
    assert.equal(sourceAllowed(url), false)
  assert.equal(
    validateBaseURL('https://api.deepseek.com/'),
    'https://api.deepseek.com',
  )
  assert.equal(
    validateBaseURL('http://localhost:11434/v1'),
    'http://localhost:11434/v1',
  )
  assert.throws(() => validateBaseURL('http://example.com'))
  assert.throws(() => validateBaseURL('https://user:key@example.com'))
})
test('fabricated references and duplicate classifications are excluded', () => {
  const items = [{ id: 'Answer:1' }, { id: 'Answer:2' }] as any
  const opinions = cleanOpinions(
    [
      {
        label: 'A',
        summary: '',
        evidenceIds: ['Answer:1', 'fake', 'Answer:1'],
      },
      { label: 'B', summary: '', evidenceIds: ['Answer:1', 'Answer:2'] },
    ],
    items,
  )
  assert.deepEqual(
    opinions.map((x) => x.evidenceIds),
    [['Answer:1'], ['Answer:2']],
  )
})

test('global sources allow web links but never executable protocols or embedded credentials', () => {
  assert.equal(sourceAllowed('https://example.com/article', 'global'), true)
  assert.equal(sourceAllowed('http://example.com/article', 'global'), true)
  assert.equal(sourceAllowed('https://example.com/article'), false)
  for (const url of ['file:///C:/test', 'javascript:alert(1)', 'https://user:secret@example.com'])
    assert.equal(sourceAllowed(url, 'global'), false)
})
