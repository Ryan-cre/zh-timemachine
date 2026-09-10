import { _electron as electron } from '@playwright/test'
import { mkdtemp, mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const profile = await mkdtemp(join(tmpdir(), 'zh-timemachine-test-'))
const output = resolve('test-results')
await mkdir(output, { recursive: true })
let injectedTruncation = false
const server = createServer(async (req, res) => {
  let body = ''
  for await (const part of req) body += part
  const input = JSON.parse(body)
  const prompt = input.messages.at(-1).content
  const truncate = prompt.includes('样本：') && !injectedTruncation
  if (truncate) injectedTruncation = true
  const content = prompt.includes('阶段：')
    ? {
        overview:
          '两个时期都出现了对未来夺冠的期待，现有样本不足以推断全站观点。',
      }
    : prompt.includes('样本：')
      ? {
          summary: '样本表达了对未来夺冠的期待。',
          opinions: [
            {
              label: '期待夺冠',
              summary: '仍然看好选手的未来。',
              evidenceIds: [prompt.includes('global:https://example.com/article') ? 'global:https://example.com/article' : 'Answer:fixture'],
            },
          ],
        }
      : prompt.includes('queries')
        ? { queries: ['NiKo Major'] }
        : { ok: true }
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(
    JSON.stringify({
      id: 'test',
      object: 'chat.completion',
      created: 1,
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: truncate ? '{"summary":' : JSON.stringify(content),
          },
          finish_reason: truncate ? 'length' : 'stop',
        },
      ],
      usage: { prompt_tokens: 20, completion_tokens: 20, total_tokens: 40 },
    }),
  )
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const port = server.address().port
const env = { ...process.env, ZH_TEST_PROFILE: profile }
delete env.ELECTRON_RUN_AS_NODE
let desktop
try {
  desktop = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: resolve('.'),
    env,
  })
  desktop.process().stderr.on('data', (data) => {
    const text = data.toString()
    if (text.includes('Model diagnostic:')) process.stderr.write(text)
  })
  const page = await desktop.firstWindow()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.getByText('开始一段研究', { exact: true }).waitFor()
  await page.screenshot({ path: join(output, 'home.png') })
  await desktop.evaluate(({ net }) => {
    const original = net.fetch.bind(net)
    globalThis.zhihuCalls = 0
    globalThis.checkpointCalls = []
    globalThis.globalRequests = []
    let checkpointFailed = false
    net.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url)
      if (url.hostname !== 'developer.zhihu.com') return original(input, init)
      globalThis.zhihuCalls++
      if (url.pathname.endsWith('/global_search')) {
        globalThis.globalRequests.push(Object.fromEntries(url.searchParams))
        return Response.json({ Code: 0, Data: { HasMore: false, Items: [{
          ContentID: 'global-fixture', ContentType: 'Article', Title: '全网样本',
          ContentText: '期待未来夺冠。', Url: 'https://example.com/article',
          EditTime: 1800000000, VoteUpCount: 0, AuthorName: '测试作者',
        }] } })
      }
      if (url.searchParams.get('Query') === '知乎') {
        return new Response(JSON.stringify({ Code: 30001, Data: null }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const range = url.searchParams.get('SortBy')?.match(/\((\d+),(\d+)\)/)
      if (range && Number(range[1]) < 1700000000) {
        const query = url.searchParams.get('Query')
        globalThis.checkpointCalls.push(query)
        if (query === '断点测试')
          return Response.json({ Code: 0, Data: { Items: [] } })
        if (!checkpointFailed) {
          checkpointFailed = true
          return Response.json({ Code: 90001, Data: null })
        }
      }
      return new Response(
        JSON.stringify({
          Code: 0,
          Data: {
            Items: [
              {
                ContentID: 'fixture',
                ContentType: 'Answer',
                Title: '如何看待 NiKo 的未来？',
                ContentText: '我依然期待他能够夺冠，这是测试样本。',
                Url: 'https://www.zhihu.com/answer/fixture',
                EditTime: range ? Number(range[1]) + 100 : 1704067200,
                VoteUpCount: null,
                AuthorName: null,
              },
            ],
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
  })
  await page.getByRole('button', { name: '模型与连接', exact: true }).click()
  await page.getByLabel('知乎 Access Secret').fill('test-zhihu-secret')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.getByText('知乎凭证已保存', { exact: true }).waitFor()
  await page.getByRole('button', { name: '添加供应商' }).click()
  await page.getByLabel('显示名称').fill('本地测试模型')
  await page
    .getByLabel('接口地址（Base URL）')
    .fill(`http://127.0.0.1:${port}/v1`)
  await page.getByLabel('模型名称', { exact: true }).fill('test-model')
  await page.getByLabel('API Key', { exact: true }).fill('test-provider-secret')
  await page.getByRole('button', { name: '保存供应商' }).click()
  await page.getByText('供应商已保存', { exact: true }).waitFor()
  await page.screenshot({ path: join(output, 'settings.png') })
  const state = await page.evaluate(() => window.desktop.state())
  assert.equal(state.settings.hasZhihuKey, true)
  assert.equal(JSON.stringify(state).includes('test-provider-secret'), false)
  const id = await page.evaluate(
    async (providerId) =>
      window.desktop.start({
        question: 'NiKo 能否夺冠',
        start: '2024-01-01',
        end: '2025-12-31',
        grain: 'year',
        providerId,
        maxSearches: 2,
      }),
    state.settings.providers[0].id,
  )
  let result
  for (let attempt = 0; attempt < 100; attempt++) {
    result = await page.evaluate(
      async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id),
      id,
    )
    if (result && result.status !== 'running') break
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  assert.equal(result.status, 'done', result.message)
  assert.equal(result.periods.length, 2)
  assert.equal(result.searches, 2)
  assert.equal(result.periods[0].opinions[0].label, '期待夺冠')
  await page.getByRole('button', { name: 'NiKo 能否夺冠', exact: true }).click()
  await page.getByText('观点随时间的变化', { exact: true }).waitFor()
  await page.screenshot({ path: join(output, 'research.png'), fullPage: true })
  await page.getByRole('button', { name: /2025/ }).click()
  assert.equal(
    await page.getByText('2025 / 阶段观点', { exact: true }).count(),
    1,
  )
  // Cancel while the model request is pending, then resume the saved task.
  const cancelledId = await page.evaluate(async (providerId) => {
    const id = await window.desktop.start({
      question: '取消恢复测试',
      start: '2024-01-01',
      end: '2024-12-31',
      grain: 'year',
      providerId,
      maxSearches: 2,
    })
    await window.desktop.cancel(id)
    return id
  }, state.settings.providers[0].id)
  for (let attempt = 0; attempt < 50; attempt++) {
    const r = await page.evaluate(
      async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id),
      cancelledId,
    )
    if (r.status === 'cancelled') break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.equal(
    await page.evaluate(
      async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id)
          .status,
      cancelledId,
    ),
    'cancelled',
  )
  await page.evaluate((id) => window.desktop.resume(id), cancelledId)
  for (let attempt = 0; attempt < 100; attempt++) {
    const r = await page.evaluate(
      async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id),
      cancelledId,
    )
    if (r.status !== 'running') {
      assert.equal(r.status, 'done', r.message)
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.equal(
    await page.evaluate(
      async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id)
          .status,
      cancelledId,
    ),
    'done',
  )
  await page.getByRole('button', { name: '模型与连接', exact: true }).click()
  await page.getByRole('button', { name: '添加供应商' }).click()
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').count(), 0)
  const checkpointId = await page.evaluate((providerId) => window.desktop.start({
    question: '断点测试', start: '2023-01-01', end: '2023-12-31',
    grain: 'year', providerId, maxSearches: 4,
  }), state.settings.providers[0].id)
  const waitResearch = async (id) => {
    for (let attempt = 0; attempt < 150; attempt++) {
      const r = await page.evaluate(async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id), id)
      if (r.status !== 'running') return r
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    throw new Error('Research did not finish')
  }
  const interrupted = await waitResearch(checkpointId)
  assert.equal(interrupted.status, 'failed')
  assert.deepEqual(interrupted.periods[0].completedQueries, ['断点测试'])
  assert.equal(interrupted.periods[0].evidence.length, 0)
  await page.evaluate((id) => window.desktop.resume(id), checkpointId)
  const resumed = await waitResearch(checkpointId)
  assert.equal(resumed.status, 'done', resumed.message)
  assert.equal(resumed.searches, 3)
  assert.deepEqual(await desktop.evaluate(() => globalThis.checkpointCalls),
    ['断点测试', 'NiKo Major', 'NiKo Major'])
  await page.getByLabel('搜索来源', { exact: true }).selectOption('global')
  await page.getByText('搜索来源已保存，用于新研究', { exact: true }).waitFor()
  assert.equal((await page.evaluate(() => window.desktop.state())).settings.searchSource, 'global')
  assert.match(await page.evaluate(() => window.desktop.testZhihu()), /连接成功/)
  const globalId = await page.evaluate((providerId) => window.desktop.start({
    question: '全网观点测试', start: '2024-01-01', end: '2025-12-31',
    grain: 'year', providerId, maxSearches: 2,
  }), state.settings.providers[0].id)
  // Changing the default while running must not change this research's source.
  await page.evaluate(() => window.desktop.saveSearchSource('zhihu'))
  const globalResult = await waitResearch(globalId)
  assert.equal(globalResult.status, 'done', globalResult.message)
  assert.equal(globalResult.input.searchSource, 'global')
  assert.equal(globalResult.periods[0].evidence[0].url, 'https://example.com/article')
  assert.equal(globalResult.periods[0].opinions[0].label, '期待夺冠')
  const globalRequests = await desktop.evaluate(() => globalThis.globalRequests)
  assert.equal(globalRequests.length, 3)
  for (const request of globalRequests) {
    assert.equal(request.Count, '20')
    assert.equal(request.SearchDB, 'all')
    assert.equal(request.SortBy, undefined)
  }
  assert.match(globalRequests[1].Filter, /^publish_time>=\d+ AND publish_time<=\d+$/)
  await assert.rejects(page.evaluate(() => window.desktop.openSource('javascript:alert(1)')), /来源链接/)
  await page.screenshot({ path: join(output, 'search-source.png') })
  await assert.rejects(page.evaluate(() => window.desktop.testZhihu()), /Code 30001/)
  const calls = await desktop.evaluate(() => globalThis.zhihuCalls)
  await assert.rejects(page.evaluate(() => window.desktop.testZhihu()), /本地冷却/)
  assert.equal(await desktop.evaluate(() => globalThis.zhihuCalls), calls)
  assert.equal(result.periods[0].searchComplete, true)
  assert.equal(result.periods[0].completedQueries.length, 1)
  const db = await readFile(join(profile, 'timemachine.db'))
  const wal = await readFile(join(profile, 'timemachine.db-wal')).catch(() =>
    Buffer.alloc(0),
  )
  for (const bytes of [db, wal]) {
    assert.equal(bytes.includes(Buffer.from('test-provider-secret')), false)
    assert.equal(bytes.includes(Buffer.from('test-zhihu-secret')), false)
  }
  assert.deepEqual(errors, [])
  console.log(
    'PASS: desktop boot, settings UI, encrypted secrets, provider adapter, two-period research, chart navigation, cancel/resume, dialog keyboard dismissal, export-safe state. Screenshots: test-results/',
  )
} finally {
  if (desktop) {
    await desktop.evaluate(({ app }) => app.exit()).catch(() => {})
    await desktop.close().catch(() => {})
  }
  server.close()
}
