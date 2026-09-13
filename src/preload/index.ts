import { contextBridge, ipcRenderer } from 'electron'
import type { DesktopAPI } from '../shared/types'
async function invoke(channel: string, ...args: unknown[]) {
  const result = await ipcRenderer.invoke(channel, ...args)
  if (!result.ok) throw new Error(result.error)
  return result.value
}
const api: DesktopAPI = {
  saveSearchSource: (source) => invoke('search:source', source),
  state: () => invoke('state'),
  saveProvider: (p) => invoke('provider:save', p),
  deleteProvider: (id) => invoke('provider:delete', id),
  saveZhihu: (key) => invoke('zhihu:save', key),
  testProvider: (id) => invoke('provider:test', id),
  testZhihu: () => invoke('zhihu:test'),
  start: (input) => invoke('research:start', input),
  resume: (id) => invoke('research:resume', id),
  cancel: (id) => invoke('research:cancel', id),
  remove: (id) => invoke('research:remove', id),
  openSource: (url) => invoke('source:open', url),
  exportResearch: (id, format) => invoke('research:export', id, format),
  onChanged: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('changed', listener)
    return () => ipcRenderer.removeListener('changed', listener)
  },
}
contextBridge.exposeInMainWorld('desktop', api)
