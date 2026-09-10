// Opt-in integration check. Credentials come only from this process's environment.
import { _electron as electron } from '@playwright/test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(import.meta.url)
const credentials = {
  zhihu: process.env.ZH_LIVE_SECRET,
  llm: process.env.ZH_LIVE_LLM_KEY,
}
if (!credentials.zhihu || !credentials.llm)
  throw new Error('Set ZH_LIVE_SECRET and ZH_LIVE_LLM_KEY for this opt-in test')
const env = { ...process.env }
delete env.ZH_LIVE_SECRET
delete env.ZH_LIVE_LLM_KEY
delete env.ELECTRON_RUN_AS_NODE
let desktop
try {
  desktop = await electron.launch({
    executablePath: require('electron'),
    args: ['.'],
    cwd: resolve('.'),
    env,
  })
  const page = await desktop.firstWindow()
  await page.getByText('开始一段研究', { exact: true }).waitFor()
  const id = await page.evaluate(async (keys) => {
    await window.desktop.saveZhihu(keys.zhihu)
    const before = await window.desktop.state()
    const existing = before.settings.providers.find(
      (p) => p.name === 'DeepSeek',
    )
    await window.desktop.saveProvider({
      id: existing?.id,
      name: 'DeepSeek',
      baseURL: 'https://api.deepseek.com',
      model: 'deepseek-v4-flash',
      key: keys.llm,
    })
    const state = await window.desktop.state()
    return window.desktop.start({
      question: 'NiKo Major',
      start: '2026-06-01',
      end: '2026-07-31',
      grain: 'month',
      maxSearches: 2,
      providerId: state.settings.providers.find((p) => p.name === 'DeepSeek')
        .id,
    })
  }, credentials)
  credentials.zhihu = ''
  credentials.llm = ''
  let lastMessage = '',
    result
  for (let attempt = 0; attempt < 180; attempt++) {
    result = await page.evaluate(
      async (id) =>
        (await window.desktop.state()).researches.find((r) => r.id === id),
      id,
    )
    if (result.message !== lastMessage) {
      console.log(result.message)
      lastMessage = result.message
    }
    if (result.status !== 'running') break
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  console.log(
    JSON.stringify({
      status: result.status,
      searches: result.searches,
      tokens: result.tokens,
      periods: result.periods.map((p) => ({
        label: p.label,
        samples: p.evidence.length,
        opinions: p.opinions.length,
      })),
    }),
  )
  if (result.status !== 'done')
    throw new Error('Live integration did not complete')
  await page
    .getByRole('button', { name: 'NiKo Major', exact: true })
    .first()
    .click()
  await page.getByText('观点随时间的变化', { exact: true }).waitFor()
  await page.screenshot({
    path: 'test-results/live-research.png',
    fullPage: true,
  })
} finally {
  if (desktop) {
    await desktop.evaluate(({ app }) => app.exit()).catch(() => {})
    await desktop.close().catch(() => {})
  }
}
