import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import * as store from './store'
import { makePeriods, sourceAllowed, validateBaseURL } from '../shared/logic'
import { search, ask } from './adapters'
import { runResearch } from './research'
import { researchToMarkdown } from '../shared/report'
import type { Research, ResearchInput } from '../shared/types'

app.setName('ZH-Timemachine')
// Test runs use an isolated profile; this is never bundled with credentials.
if (process.env.ZH_TEST_PROFILE && !app.isPackaged)
  app.setPath('userData', process.env.ZH_TEST_PROFILE)
let window: BrowserWindow | null = null
let running: { id: string; controller: AbortController } | undefined
const changed = () => window?.webContents.send('changed')
const getResearch = (id: string) => {
  const r = store.researches().find((x) => x.id === id)
  if (!r) throw new Error('研究不存在')
  return r
}
const getProvider = (id: string) => {
  const p = store.settings().providers.find((x) => x.id === id)
  if (!p) throw new Error('请先添加模型供应商')
  return p
}
function launch(r: Research) {
  if (running) throw new Error('已有研究正在运行')
  const p = getProvider(r.input.providerId)
  store.getSecret('zhihu')
  store.getSecret(p.id)
  r.status = 'running'
  store.saveResearch(r)
  const controller = new AbortController()
  running = { id: r.id, controller }
  void runResearch(r, p, controller.signal, changed).finally(() => {
    running = undefined
    changed()
  })
}
function wire() {
  const handle = (name: string, fn: (...args: any[]) => unknown) =>
    ipcMain.handle(name, async (event, ...args) => {
      if (
        !window ||
        event.sender !== window.webContents ||
        event.senderFrame !== window.webContents.mainFrame
      )
        throw new Error('无效请求来源')
      try {
        const result = await fn(...args)
        if (name !== 'state') changed()
        return { ok: true, value: result }
      } catch (e) {
        return {
          ok: false,
          error:
            e instanceof z.ZodError
              ? '请检查输入格式和长度'
              : (e as Error).message,
        }
      }
    })
  handle('state', () => ({
    settings: store.settings(),
    researches: store.researches(),
  }))
  handle('provider:save', (raw) => {
    const p = z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(60),
        baseURL: z.string().max(500),
        model: z.string().trim().min(1).max(120),
        key: z.string().trim().max(4000).optional(),
      })
      .parse(raw)
    const id = p.id ?? randomUUID(),
      baseURL = validateBaseURL(p.baseURL)
    if (running && getResearch(running.id).input.providerId === id)
      throw new Error('请等待当前研究结束后修改供应商')
    if (p.key) store.setSecret(id, p.key)
    if (!store.hasSecret(id)) throw new Error('请输入 API Key')
    store.saveProvider({
      id,
      name: p.name,
      baseURL,
      model: p.model,
      hasKey: true,
    })
  })
  handle('provider:delete', (id) => {
    z.string().uuid().parse(id)
    if (running && getResearch(running.id).input.providerId === id)
      throw new Error('供应商正在使用中')
    store.deleteProvider(id)
  })
  handle('zhihu:save', (key) => {
    if (running) throw new Error('请等待当前研究结束后修改凭证')
    store.setSecret('zhihu', z.string().trim().min(1).max(4000).parse(key))
  })
  handle('search:source', (source) => {
    store.saveSearchSource(z.enum(['zhihu', 'global']).parse(source))
  })
  handle('provider:test', async (id) => {
    const result = await ask(
      getProvider(z.string().uuid().parse(id)),
      '返回 JSON：{"ok":true}',
      new AbortController().signal,
      300,
    )
    return `连接成功 · ${result.tokens} tokens`
  })
  handle('zhihu:test', async () => {
    const result = await search(
      '知乎',
      undefined,
      undefined,
      new AbortController().signal,
      false,
      undefined,
      store.settings().searchSource,
    )
    return `连接成功 · 返回 ${result.items.length} 条结果`
  })
  handle('research:start', (raw) => {
    if (running) throw new Error('已有研究正在运行')
    const input: ResearchInput = z
      .object({
        question: z.string().trim().min(2).max(200),
        start: z.string(),
        end: z.string(),
        grain: z.enum(['year', 'quarter', 'month']),
        providerId: z.string().uuid(),
        maxSearches: z.number().int().min(1).max(72),
      })
      .parse(raw)
    input.searchSource = store.settings().searchSource
    const periods = makePeriods(input.start, input.end, input.grain)
    if (input.maxSearches < periods.length)
      throw new Error(`至少需要 ${periods.length} 次搜索才能覆盖全部时间段`)
    const r: Research = {
      id: randomUUID(),
      input,
      createdAt: new Date().toISOString(),
      status: 'running',
      message: '准备开始',
      periods,
      searches: 0,
      tokens: 0,
      overview: '',
      queries: [],
      model: getProvider(input.providerId).model,
    }
    launch(r)
    return r.id
  })
  handle('research:resume', (id) => {
    const r = getResearch(z.string().uuid().parse(id))
    if (r.status === 'done') throw new Error('研究已完成')
    launch(r)
  })
  handle('research:cancel', (id) => {
    if (running && running.id === id) running.controller.abort()
  })
  handle('research:remove', (id) => {
    if (running?.id === id) throw new Error('请先取消研究')
    store.removeResearch(z.string().uuid().parse(id))
  })
  handle('source:open', async (url) => {
    z.string().parse(url)
    const known = store.researches().some((r) => r.periods.some((p) => p.evidence.some((e) => e.url === url)))
    if (!known || !sourceAllowed(url, 'global'))
      throw new Error('只允许打开已保存的网页来源链接')
    await shell.openExternal(url)
  })
  handle('research:export', async (id, rawFormat) => {
    const r = getResearch(z.string().uuid().parse(id))
    const format = z.enum(['markdown', 'json']).default('markdown').parse(rawFormat)
    const markdown = format === 'markdown'
    const result = await dialog.showSaveDialog(window!, {
      defaultPath: markdown ? '观点变化研究报告.md' : '观点研究数据.json',
      filters: [
        markdown
          ? { name: 'Markdown 研究报告', extensions: ['md'] }
          : { name: '研究数据 JSON', extensions: ['json'] },
      ],
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(
      result.filePath,
      markdown ? researchToMarkdown(r) : JSON.stringify(r, null, 2),
      'utf8',
    )
    return true
  })
}
function createWindow() {
  window = new BrowserWindow({
    icon: join(app.getAppPath(), 'assets/icon.png'),
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: '#f7f8fa',
    title: 'ZH-Timemachine',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.session.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  )
  window.once('ready-to-show', () => window?.show())
  window.on('close', (event) => {
    if (
      running &&
      dialog.showMessageBoxSync(window!, {
        type: 'question',
        buttons: ['继续研究', '停止并退出'],
        defaultId: 0,
        cancelId: 0,
        message: '研究仍在进行，关闭后将停止。已完成阶段会保留。',
      }) === 0
    )
      event.preventDefault()
    else running?.controller.abort()
  })
  window.on('closed', () => {
    window = null
  })
  const devURL = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  void window.loadURL(
    devURL ??
      pathToFileURL(
        join(import.meta.dirname, '../renderer/index.html'),
      ).toString(),
  )
}
if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => {
    window?.restore()
    window?.focus()
  })
  app.whenReady().then(() => {
    store.initStore()
    Menu.setApplicationMenu(null)
    wire()
    createWindow()
    app.on('activate', () => {
      if (!window) createWindow()
    })
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
