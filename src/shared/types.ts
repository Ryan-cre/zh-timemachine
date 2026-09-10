export interface Provider {
  id: string
  name: string
  baseURL: string
  model: string
  hasKey: boolean
}
export interface Settings {
  providers: Provider[]
  hasZhihuKey: boolean
  secureStorage: boolean
}
export interface ProviderInput {
  id?: string
  name: string
  baseURL: string
  model: string
  key?: string
}
export interface ResearchInput {
  question: string
  start: string
  end: string
  grain: 'year' | 'quarter' | 'month'
  providerId: string
  maxSearches: number
}
export interface Evidence {
  id: string
  title: string
  text: string
  url: string
  time: number
  votes: number
  author: string
  capturedAt: string
}
export interface Opinion {
  label: string
  summary: string
  evidenceIds: string[]
}
export interface Period {
  label: string
  from: number
  to: number
  evidence: Evidence[]
  summary: string
  opinions: Opinion[]
  status: 'pending' | 'done'
  saturated: boolean
}
export interface Research {
  id: string
  input: ResearchInput
  createdAt: string
  status: 'running' | 'done' | 'failed' | 'cancelled'
  message: string
  periods: Period[]
  searches: number
  tokens: number
  overview: string
  queries: string[]
  model: string
}
export interface AppState {
  settings: Settings
  researches: Research[]
}
export interface DesktopAPI {
  state(): Promise<AppState>
  saveProvider(input: ProviderInput): Promise<void>
  deleteProvider(id: string): Promise<void>
  saveZhihu(key: string): Promise<void>
  testProvider(id: string): Promise<string>
  testZhihu(): Promise<string>
  start(input: ResearchInput): Promise<string>
  resume(id: string): Promise<void>
  cancel(id: string): Promise<void>
  remove(id: string): Promise<void>
  openSource(url: string): Promise<void>
  exportResearch(id: string): Promise<boolean>
  onChanged(callback: () => void): () => void
}
