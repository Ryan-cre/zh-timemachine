import * as Dialog from '@radix-ui/react-dialog'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Activity,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Database,
  Download,
  History,
  KeyRound,
  Layers3,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Settings2,
  Sparkles,
  Trash2,
  X,
  Cable,
  Orbit,
  Box,
  MousePointer2,
  Maximize2,
  Radio,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type {
  AppState,
  Provider,
  ProviderInput,
  Research,
  ResearchInput,
} from '../../shared/types'
import { makePeriods } from '../../shared/logic'

const TimeGalaxy3D = lazy(() => import('./TimeGalaxy3D'))
import { GATE_GALAXY } from './gateGalaxy'
import type { GalaxyData } from './TimeGalaxy3D'

const api = window.desktop
const COLORS = [
  '#7061db',
  '#4d9bb2',
  '#d3a055',
  '#b7779d',
  '#75a184',
  '#9295a8',
  '#a684db',
  '#769ed0',
]
const statuses = {
  running: '分析中',
  done: '已完成',
  failed: '待重试',
  cancelled: '已暂停',
}
const INITIAL: ResearchInput = {
  question: '',
  start: '2020-01-01',
  end: new Date().toISOString().slice(0, 10),
  grain: 'year',
  providerId: '',
  maxSearches: 24,
}
function IconLabel({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>
}
const buttonStyle = cva('button')
function Button({
  children,
  kind = '',
  asChild = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: string
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      {...props}
      className={twMerge(clsx(buttonStyle(), kind, props.className))}
    >
      {children}
    </Comp>
  )
}

export default function App() {
  const [state, setState] = useState<AppState>(),
    [page, setPage] = useState<'gate' | 'home' | 'research' | 'history' | 'settings'>('gate'),
    [selected, setSelected] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [form, setForm] = useState<ResearchInput>(INITIAL),
    [periodIndex, setPeriodIndex] = useState(0),
    [opinionFilter, setOpinionFilter] = useState('')
  const [providerForm, setProviderForm] = useState<ProviderInput | null>(null),
    [zhihuKey, setZhihuKey] = useState('')
  const [immersive3D, setImmersive3D] = useState(false)
  const [detailView, setDetailView] = useState<'2d' | '3d'>('2d')
  const [visualMode, setVisualMode] = useState<'2d' | '3d'>(() => {
    try {
      return localStorage.getItem('zh-timemachine-visual-mode') === '2d' ? '2d' : '3d'
    } catch {
      return '3d'
    }
  })
  const chooseVisualMode = (mode: '2d' | '3d') => {
    setVisualMode(mode)
    try {
      localStorage.setItem('zh-timemachine-visual-mode', mode)
    } catch {
      // The visual preference is optional when storage is unavailable.
    }
  }
  const handle3DUnavailable = useCallback(() => {
    setVisualMode('2d')
    setImmersive3D(false)
    setNotice('当前设备无法启用 WebGL，已自动切换到轻量 2D 模式。')
  }, [])
  const refresh = async () => {
    try {
      setState(await api.state())
    } catch (e) {
      setNotice((e as Error).message)
    }
  }
  useEffect(() => {
    if (!api) return
    void refresh()
    return api.onChanged(() => void refresh())
  }, [])
  useEffect(() => {
    if (
      state &&
      !state.settings.providers.some((p) => p.id === form.providerId)
    )
      setForm((f) => ({
        ...f,
        providerId: state.settings.providers[0]?.id ?? '',
      }))
  }, [state])
  useEffect(() => {
    if (notice) {
      const id = setTimeout(() => setNotice(''), 8000)
      return () => clearTimeout(id)
    }
  }, [notice])
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const open = (r: Research) => {
    setSelected(r.id)
    setPage('research')
    setPeriodIndex(0)
    setOpinionFilter('')
  }
  // 3D 星图数据：每个研究问题一张专属星图（节点=年份，颜色=主导立场，大小=样本量）
  // 必须放在所有早期 return 之前，保证 hooks 顺序稳定。
  const galaxyData: GalaxyData | null = useMemo(() => {
    const research = state?.researches.find((r) => r.id === selected)
    if (!research) return null
    const labels = Array.from(
      new Set(
        research.periods.flatMap((p) => p.opinions.map((o) => o.label)),
      ),
    )
    const labelColor = Object.fromEntries(
      labels.map((label, i) => [label, COLORS[i % COLORS.length]]),
    )
    return {
      question: research.input.question,
      totalSamples: research.periods.reduce(
        (sum, p) => sum + p.evidence.length,
        0,
      ),
      colors: labelColor,
      periods: research.periods.map((p) => {
        const counts = labels.map((label) =>
          p.opinions
            .filter((o) => o.label === label)
            .reduce((sum, o) => sum + o.evidenceIds.length, 0),
        )
        const assigned = counts.reduce((a, b) => a + b, 0)
        // “未归类”不作为主导立场展示
        const named = labels
          .map((label, i) => ({ label, count: counts[i] }))
          .filter((x) => x.label !== '未归类' && x.count > 0)
          .sort((a, b) => b.count - a.count)
        const top = named[0]
        return {
          label: p.label,
          sampleCount: p.evidence.length,
          dominantLabel: top ? top.label : '观点聚类中',
          dominantShare: top && assigned ? top.count / assigned : 0,
          summary:
            p.opinions
              .filter((o) => o.label !== '未归类')
              .slice()
              .sort((a, b) => b.evidenceIds.length - a.evidenceIds.length)[0]
              ?.summary?.slice(0, 44) ?? '',
        }
      }),
    }
  }, [state, selected])
  const jumpToPeriod = useCallback((index: number) => {
    setPeriodIndex(index)
    setOpinionFilter('')
    document
      .getElementById('period-detail')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  if (!api)
    return (
      <div className="boot">
        <Orbit size={40} />
        <h1>请通过桌面应用打开</h1>
        <p>运行 npm run dev 启动 ZH-Timemachine。</p>
      </div>
    )
  if (!state)
    return (
      <div className="boot">
        <LoaderCircle className="spin" />
        <p>{notice || '正在打开时间档案…'}</p>
      </div>
    )
  const settings = state.settings,
    studies = state.researches,
    active = studies.find((r) => r.status === 'running'),
    research = studies.find((r) => r.id === selected)
  let segments = 0,
    dateError = ''
  try {
    segments = makePeriods(form.start, form.end, form.grain).length
  } catch (e) {
    dateError = (e as Error).message
  }
  const showResearch = page === 'research' && research
  const start = (e: FormEvent) => {
    e.preventDefault()
    void action(async () => {
      const id = await api.start(form)
      setSelected(id)
      setPage('research')
      setPeriodIndex(0)
      setOpinionFilter('')
    })
  }
  const editProvider = (p?: Provider) =>
    setProviderForm(
      p
        ? {
            id: p.id,
            name: p.name,
            baseURL: p.baseURL,
            model: p.model,
            key: '',
          }
        : {
            name: 'DeepSeek',
            baseURL: 'https://api.deepseek.com',
            model: 'deepseek-v4-flash',
            key: '',
          },
    )
  const labels = research
    ? [
        ...new Set(
          research.periods.flatMap((p) => p.opinions.map((o) => o.label)),
        ),
      ]
    : []
  const chartData = research?.periods.map((p, i) => {
    // 防御性归一化：以各立场实际分到的证据数为分母重标定，
    // 保证每根柱子各段加总恒为 100，避免出现 >100% 的越界刻度。
    const counts = labels.map((label) =>
      p.status === 'done'
        ? p.opinions
            .filter((o) => o.label === label)
            .reduce((sum, o) => sum + o.evidenceIds.length, 0)
        : 0,
    )
    const assigned = counts.reduce((a, b) => a + b, 0)
    return {
      name: p.label,
      index: i,
      ...Object.fromEntries(
        labels.map((label, j) => [
          `v${j}`,
          p.status === 'done' && p.evidence.length && assigned
            ? (counts[j] / assigned) * 100
            : null,
        ]),
      ),
    }
  })
  const period = research?.periods[periodIndex]

  // 启动落地页：打开应用第一眼即是可交互的真实星图
  if (page === 'gate') {
    return (
      <div className="gate">
        <div className="gate-canvas">
          <Suspense fallback={<span className="stage-loading">正在构建时间宇宙…</span>}>
            <TimeGalaxy3D immersive data={GATE_GALAXY} onUnavailable={() => setPage('home')} />
          </Suspense>
        </div>
        <header className="gate-topbar">
          <div className="gate-brand">
            <span className="gate-brand-mark"><Orbit size={20} /></span>
            <span><strong>ZH-TIMEMACHINE</strong><small>PERSPECTIVE OBSERVATORY</small></span>
          </div>
          <div className="gate-live"><i /> LIVE RENDER</div>
        </header>

        <div className="gate-center">
          <IconLabel><Sparkles size={14} /> 知乎黑客松 2026 · 时间机</IconLabel>
          <h1 className="gate-title">看见观点，<br /><em>如何被时间改变</em></h1>
          <p className="gate-sub">
            把一个问题铺在时间轴上 —— 从 {GATE_GALAXY.periods[0]?.label} 到{' '}
            {GATE_GALAXY.periods[GATE_GALAXY.periods.length - 1]?.label}，
            {GATE_GALAXY.totalSamples} 条真实知乎回答，聚成一张可旋转的立场星图。
          </p>
          <button type="button" className="gate-cta" onClick={() => setPage('home')}>
            <span className="gate-cta-ring" />
            <span className="gate-cta-text">点击此处开始探索</span>
            <ArrowRight size={18} />
          </button>
          <div className="gate-hint">
            <MousePointer2 size={13} /> 拖拽旋转 · 滚轮缩放 · 点击年份节点
          </div>
        </div>

        <div className="gate-foot">
          <span><strong>{GATE_GALAXY.totalSamples}</strong> 条真实回答</span>
          <i />
          <span><strong>{GATE_GALAXY.periods.length}</strong> 个年份</span>
          <i />
          <span>来源 <strong>ZHIHU</strong></span>
        </div>
      </div>
    )
  }

  // 当年中心观点：已归类立场中样本量最大的一个，颜色与 2D/3D 立场配色一致
  const dominant =
    period && period.status === 'done'
      ? period.opinions
          .filter((o) => o.label !== '未归类' && o.evidenceIds.length > 0)
          .map((o) => ({ ...o, color: COLORS[labels.indexOf(o.label) % COLORS.length] }))
          .sort((a, b) => b.evidenceIds.length - a.evidenceIds.length)[0] ?? null
      : null
  const dominantShare =
    dominant && period && period.evidence.length
      ? Math.round((dominant.evidenceIds.length / period.evidence.length) * 100)
      : 0
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage('home')}>
          <span className="brand-mark">
            <Orbit size={26} />
          </span>
          <span>
            ZH-Timemachine<small>让观点，留下时间的刻度</small>
          </span>
        </button>
        <div className="competition-tag">
          <span>知乎黑客松</span>
          <strong>2026 · ENTRY</strong>
        </div>
        <Button
          kind="primary new-research"
          onClick={() => {
            setPage('home')
            setForm((f) => ({ ...f, question: '' }))
          }}
        >
          <Plus size={17} /> 新建研究
        </Button>
        <nav>
          <button
            className={page === 'home' ? 'nav-item current' : 'nav-item'}
            onClick={() => setPage('home')}
          >
            <Layers3 size={18} />
            研究工作台
          </button>
          <button
            className={page === 'history' ? 'nav-item current' : 'nav-item'}
            onClick={() => setPage('history')}
          >
            <History size={18} />
            时间档案<span className="nav-count">{studies.length}</span>
          </button>
        </nav>
        <div className="sidebar-heading">最近研究</div>
        <div className="recent-list">
          {studies.slice(0, 6).map((r) => (
            <button
              key={r.id}
              className={`recent-item ${selected === r.id && page === 'research' ? 'selected' : ''}`}
              onClick={() => open(r)}
            >
              <span className={`dot ${r.status}`} />
              <span>{r.input.question}</span>
            </button>
          ))}
          {!studies.length && (
            <p className="sidebar-empty">
              你的第一段时间旅程
              <br />
              会保存在这里。
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="dot done" /> 本地工作空间
            <small>数据保存在这台设备上</small>
          </div>
          <button
            className={page === 'settings' ? 'nav-item current' : 'nav-item'}
            onClick={() => setPage('settings')}
          >
            <Settings2 size={18} />
            模型与连接
          </button>
          <div className="version">
            DESKTOP PREVIEW <span>0.1.0</span>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            工作空间 <ChevronRight size={14} />{' '}
            {page === 'settings'
              ? '模型与连接'
              : page === 'history'
                ? '时间档案'
                : showResearch
                  ? '研究详情'
                  : '研究工作台'}
          </span>
          <span className="top-status">
            <span className={`dot ${active ? 'running' : 'done'}`} />
            {active ? '研究进行中' : '本地运行'}
            <span className="top-divider" />
            <Clock3 size={14} /> Asia / Shanghai
          </span>
        </header>
        <div className="content">
          {page === 'home' && (
            <>
              <section className="hero">
                <div className="hero-copy">
                  <IconLabel>
                    <Sparkles size={14} /> PERSPECTIVE INTELLIGENCE
                  </IconLabel>
                  <h1>
                    看见观点，
                    <br />
                    <span>如何被时间改变。</span>
                  </h1>
                  <p>
                    从{settings.searchSource === 'global' ? '全网' : '知乎'}的讨论中提取证据、梳理语境，
                    <br />
                    让每一次立场转折都有迹可循。
                  </p>
                  <div className="hero-proof">
                    <span><ShieldCheck size={14} /> 来源可回溯</span>
                    <span><Activity size={14} /> 变化可量化</span>
                  </div>
                  <button
                    className="launch-galaxy"
                    type="button"
                    onClick={() => {
                      chooseVisualMode('3d')
                      setImmersive3D(true)
                    }}
                  >
                    <span><Radio size={13} /> LIVE 3D EXPERIENCE</span>
                    进入沉浸式时间宇宙
                    <Maximize2 size={15} />
                  </button>
                </div>
                <div className={`time-window ${visualMode === '3d' ? 'is-3d' : ''}`}>
                  <div className="time-window-head">
                    <span>TIME SIGNAL</span>
                    <i />
                    <small>概念示意 · 非研究数据</small>
                    <div className="visual-mode-switch" role="group" aria-label="视觉模式">
                      <button
                        className={visualMode === '2d' ? 'active' : ''}
                        type="button"
                        onClick={() => chooseVisualMode('2d')}
                        aria-pressed={visualMode === '2d'}
                      >
                        2D
                      </button>
                      <button
                        className={visualMode === '3d' ? 'active' : ''}
                        type="button"
                        onClick={() => chooseVisualMode('3d')}
                        aria-pressed={visualMode === '3d'}
                      >
                        <Box size={10} /> 3D
                      </button>
                    </div>
                  </div>
                  {visualMode === '3d' && !immersive3D ? (
                    <Suspense fallback={<span className="galaxy-loading">正在加载 3D 引擎…</span>}>
                      <TimeGalaxy3D onUnavailable={handle3DUnavailable} />
                    </Suspense>
                  ) : visualMode === '3d' ? (
                    <div className="galaxy-standby" aria-hidden="true">
                      <Radio size={26} /> IMMERSIVE VIEW ACTIVE
                    </div>
                  ) : (
                    <>
                      <div className="orbital-system" aria-hidden="true">
                        <span className="orbit-ring ring-one" />
                        <span className="orbit-ring ring-two" />
                        <span className="orbit-ring ring-three" />
                        <span className="orbit-particle particle-one" />
                        <span className="orbit-particle particle-two" />
                        <span className="orbit-core">
                          <Orbit size={28} strokeWidth={1.2} />
                        </span>
                      </div>
                      <div className="signal-chart" aria-hidden="true">
                        <div className="signal-line" />
                        {[
                          ['2020', '问题出现', '12%'],
                          ['2023', '观点分化', '47%'],
                          ['2026', '共识重组', '81%'],
                        ].map(([year, label, value], index) => (
                          <div className={`signal-point p${index + 1}`} key={year}>
                            <i />
                            <span>{year}</span>
                            <strong>{label}</strong>
                            <small>{value}</small>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="time-window-foot">
                    {visualMode === '3d' ? (
                      <><MousePointer2 size={10} /><span>拖拽旋转</span><i /><span>滚轮缩放</span></>
                    ) : (
                      <><span>检索</span><i /><span>归因</span><i /><span>演变</span></>
                    )}
                  </div>
                </div>
              </section>
              <section className="method-strip" aria-label="研究方法">
                {[
                  ['01', 'SEARCH', '跨时间检索', '找到关键讨论与原始证据'],
                  ['02', 'SYNTHESIZE', '观点聚类', '提炼立场、共识与分歧'],
                  ['03', 'TRACE', '变化溯源', '解释拐点为何发生'],
                ].map(([step, code, title, copy]) => (
                  <div className="method-step" key={step}>
                    <span>{step}</span>
                    <div>
                      <small>{code}</small>
                      <strong>{title}</strong>
                      <p>{copy}</p>
                    </div>
                  </div>
                ))}
              </section>
              <form className="research-form panel" onSubmit={start}>
                <div className="panel-heading">
                  <span>
                    <Search size={18} /> 开始一段研究
                  </span>
                  <span className="subtle">01 / DEFINE THE QUESTION</span>
                </div>
                <label className="question-label" htmlFor="question">
                  你想观察什么？
                </label>
                <textarea
                  id="question"
                  maxLength={200}
                  required
                  minLength={2}
                  placeholder="例如：大家对 NiKo 能否夺得 Major 的看法，如何变化？"
                  value={form.question}
                  onChange={(e) =>
                    setForm({ ...form, question: e.target.value })
                  }
                />
                <div className="form-grid">
                  <label>
                    开始日期
                    <input
                      type="date"
                      required
                      value={form.start}
                      onChange={(e) =>
                        setForm({ ...form, start: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    结束日期
                    <input
                      type="date"
                      required
                      value={form.end}
                      onChange={(e) =>
                        setForm({ ...form, end: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    时间粒度
                    <select
                      value={form.grain}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          grain: e.target.value as ResearchInput['grain'],
                        })
                      }
                    >
                      <option value="year">按年</option>
                      <option value="quarter">按季度</option>
                      <option value="month">按月</option>
                    </select>
                  </label>
                </div>
                <div className="form-grid second">
                  <label>
                    分析模型
                    <select
                      value={form.providerId}
                      onChange={(e) =>
                        setForm({ ...form, providerId: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        先添加模型供应商
                      </option>
                      {settings.providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} / {p.model}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    最多搜索次数
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={form.maxSearches}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          maxSearches: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <div className="form-footer">
                  <div>
                    <span>
                      {dateError ||
                        `${segments} 个时间段 · ${settings.searchSource === 'global' ? '全网搜索 · 每次最多 20' : '知乎搜索 · 每次最多 10'} 条搜索结果`}
                    </span>
                    <small>
                      模型调用按供应商计费，完成后显示实际 token 用量。
                    </small>
                  </div>
                  <Button
                    kind="primary"
                    disabled={
                      busy ||
                      !!active ||
                      !!dateError ||
                      !settings.hasZhihuKey ||
                      !form.providerId ||
                      form.maxSearches < segments
                    }
                    type="submit"
                  >
                    开始研究 <ArrowRight size={17} />
                  </Button>
                </div>
                {(!settings.hasZhihuKey || !settings.providers.length) && (
                  <button
                    type="button"
                    className="setup-hint"
                    onClick={() => setPage('settings')}
                  >
                    <Cable size={16} /> 先连接知乎和模型，开启你的第一次研究{' '}
                    <ArrowRight size={15} />
                  </button>
                )}
              </form>
              <section className="suggestions">
                <IconLabel>DEMO-READY QUESTIONS · 从一个熟悉的问题开始</IconLabel>
                <div className="suggestion-grid">
                  {[
                    'NiKo 能否夺得 Major',
                    'AI 编程会取代程序员吗',
                    '新能源汽车值得购买吗',
                  ].map((q, i) => (
                    <button
                      key={q}
                      onClick={() => setForm((f) => ({ ...f, question: q }))}
                    >
                      <span>0{i + 1}</span>
                      <strong>{q}</strong>
                      <ArrowUpRight size={17} />
                    </button>
                  ))}
                </div>
              </section>
              <div className="method-note">
                <BookOpen size={16} />
                <p>
                  观察的是检索样本中的观点，而非全站民意。每一个阶段，都保留可回看的来源。
                </p>
              </div>
            </>
          )}
          {page === 'history' && (
            <>
              <div className="page-heading">
                <IconLabel>YOUR RESEARCH LIBRARY</IconLabel>
                <h1>时间档案</h1>
                <p>每一次研究，都是一个问题的时间切片。</p>
              </div>
              {!studies.length ? (
                <div className="empty panel">
                  <History size={34} />
                  <h3>还没有留下时间的足迹</h3>
                  <p>从一个感兴趣的问题开始。</p>
                  <Button onClick={() => setPage('home')}>
                    新建研究 <ArrowRight size={16} />
                  </Button>
                </div>
              ) : (
                <div className="history-grid">
                  {studies.map((r) => (
                    <button
                      className="history-card panel"
                      key={r.id}
                      onClick={() => open(r)}
                    >
                      <div>
                        <span className={`badge ${r.status}`}>
                          {statuses[r.status]}
                        </span>
                        <ArrowUpRight size={18} />
                      </div>
                      <h3>{r.input.question}</h3>
                      <p>
                        {r.input.start} — {r.input.end}
                      </p>
                      <footer>
                        {r.periods.length} 个阶段
                        <span>
                          {r.periods.reduce((s, p) => s + p.evidence.length, 0)}{' '}
                          条样本
                        </span>
                      </footer>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {page === 'settings' && (
            <>
              <div className="page-heading">
                <IconLabel>MAKE YOUR CONNECTIONS</IconLabel>
                <h1>模型与连接</h1>
                <p>用自己的服务，连接你的研究。</p>
              </div>
              <section className="panel settings-section">
                <div className="section-title">
                  <div className="setting-icon zh">知</div>
                  <div>
                    <h2>知乎开放平台</h2>
                    <p>获取问题、回答与文章的搜索摘要</p>
                  </div>
                  <span
                    className={`badge ${settings.hasZhihuKey ? 'done' : ''}`}
                  >
                    {settings.hasZhihuKey ? '已配置' : '未连接'}
                  </span>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void action(async () => {
                      await api.saveZhihu(zhihuKey)
                      setZhihuKey('')
                      setNotice('知乎凭证已保存')
                    })
                  }}
                >
                  <label>
                    搜索来源
                    <select
                      aria-label="搜索来源"
                      value={settings.searchSource}
                      disabled={busy}
                      onChange={(e) => {
                        const source = e.target.value as 'zhihu' | 'global'
                        void action(async () => {
                          await api.saveSearchSource(source)
                          setNotice('搜索来源已保存，用于新研究')
                        })
                      }}
                    >
                      <option value="zhihu">知乎搜索</option>
                      <option value="global">全网搜索</option>
                    </select>
                  </label>
                  <p className="sample-note">共用下方凭证；切换仅影响新研究，测试连接使用当前选择。</p>
                  <label>
                    Access Secret
                    <div className="input-action">
                      <input
                        aria-label="知乎 Access Secret"
                        type="password"
                        autoComplete="off"
                        value={zhihuKey}
                        onChange={(e) => setZhihuKey(e.target.value)}
                        placeholder={
                          settings.hasZhihuKey
                            ? '已加密保存，输入新凭证可替换'
                            : '输入知乎开放平台凭证'
                        }
                      />
                      <Button disabled={busy || !zhihuKey} type="submit">
                        保存
                      </Button>
                      <Button
                        type="button"
                        disabled={busy || !settings.hasZhihuKey}
                        onClick={() =>
                          void action(async () =>
                            setNotice(await api.testZhihu()),
                          )
                        }
                      >
                        测试连接
                      </Button>
                    </div>
                  </label>
                </form>
              </section>
              <section className="panel settings-section">
                <div className="section-title">
                  <div className="setting-icon">
                    <Sparkles size={23} />
                  </div>
                  <div>
                    <h2>模型供应商</h2>
                    <p>支持 DeepSeek 与 OpenAI 兼容的 Chat Completions 接口</p>
                  </div>
                  <Button onClick={() => editProvider()}>
                    <Plus size={16} />
                    添加供应商
                  </Button>
                </div>
                {settings.providers.map((p) => (
                  <div className="provider-row" key={p.id}>
                    <div className="provider-avatar">{p.name.slice(0, 1)}</div>
                    <div className="provider-info">
                      <strong>{p.name}</strong>
                      <span>{p.model}</span>
                      <small>{p.baseURL}</small>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(async () =>
                          setNotice(await api.testProvider(p.id)),
                        )
                      }
                    >
                      测试
                    </Button>
                    <Button onClick={() => editProvider(p)}>编辑</Button>
                    <Button
                      aria-label={`删除 ${p.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          confirm(`删除供应商“${p.name}”？已保存的研究会保留。`)
                        )
                          void action(() => api.deleteProvider(p.id))
                      }}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                ))}
                {!settings.providers.length && (
                  <div className="provider-empty">
                    <Plus size={22} />
                    <span>添加第一个供应商，选择你熟悉的模型。</span>
                  </div>
                )}
              </section>
              <div className="security-note">
                <KeyRound size={18} />
                <p>
                  {settings.secureStorage
                    ? '密钥通过系统安全存储加密，保存在本机。界面不会读取已保存的密钥。'
                    : '系统安全存储不可用，请启用系统钥匙串后保存凭证。'}
                  <br />
                  研究摘要会发送到你选择的模型供应商进行分析。
                </p>
              </div>
            </>
          )}
          {showResearch && (
            <>
              <div className="result-top">
                <button
                  className="text-button"
                  onClick={() => setPage('history')}
                >
                  <ArrowLeft size={15} /> 时间档案
                </button>
                <div>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        if (await api.exportResearch(research.id, 'markdown'))
                          setNotice('Markdown 研究报告已导出')
                      })
                    }
                  >
                    <Download size={15} />
                    导出报告
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        if (await api.exportResearch(research.id, 'json'))
                          setNotice('JSON 研究数据已导出')
                      })
                    }
                  >
                    <Database size={15} />
                    JSON
                  </Button>
                  {research.status === 'running' ? (
                    <Button
                      onClick={() => void action(() => api.cancel(research.id))}
                    >
                      取消研究
                    </Button>
                  ) : (
                    <>
                      <Button
                        aria-label="删除研究"
                        onClick={() => {
                          if (confirm('删除这份本地研究？'))
                            void action(async () => {
                              await api.remove(research.id)
                              setPage('history')
                            })
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                      {research.status !== 'done' && (
                        <Button
                          kind="primary"
                          disabled={busy || !!active}
                          onClick={() =>
                            void action(() => api.resume(research.id))
                          }
                        >
                          继续分析
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="page-heading result-heading">
                <span className={`badge ${research.status}`}>
                  {research.status === 'running' && (
                    <LoaderCircle size={12} className="spin" />
                  )}
                  {statuses[research.status]}
                </span>
                <h1>{research.input.question}</h1>
                <p>
                  {research.input.start} — {research.input.end}{' '}
                  <span className="inline-dot">·</span> {research.model}
                  <span className="inline-dot">·</span> {research.input.searchSource === 'global' ? '全网搜索' : '知乎搜索'}
                </p>
              </div>
              <div className="stats">
                <div>
                  <span>观察阶段</span>
                  <strong>
                    {research.periods.filter((p) => p.status === 'done').length}
                    <small> / {research.periods.length}</small>
                  </strong>
                </div>
                <div>
                  <span>收集样本</span>
                  <strong>
                    {research.periods.reduce(
                      (s, p) => s + p.evidence.length,
                      0,
                    )}
                    <small> 条</small>
                  </strong>
                </div>
                <div>
                  <span>搜索次数（含缓存）</span>
                  <strong>
                    {research.searches}
                    <small> / {research.input.maxSearches}</small>
                  </strong>
                </div>
                <div>
                  <span>模型用量</span>
                  <strong>
                    {research.tokens.toLocaleString()}
                    <small> tokens</small>
                  </strong>
                </div>
              </div>
              <div className="progress-note">
                <span className={`dot ${research.status}`} />
                {research.message}
              </div>
              {research.overview && (
                <section className="overview panel">
                  <IconLabel>
                    <Sparkles size={14} /> 变化概览
                  </IconLabel>
                  <p>{research.overview}</p>
                </section>
              )}
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <span>观点随时间的变化</span>
                  <span className="chart-heading-right">
                    {galaxyData && (
                      <span className="detail-visual-switch">
                        <button
                          className={detailView === '2d' ? 'active' : ''}
                          type="button"
                          onClick={() => setDetailView('2d')}
                        >
                          2D
                        </button>
                        <button
                          className={detailView === '3d' ? 'active' : ''}
                          type="button"
                          onClick={() => setDetailView('3d')}
                        >
                          <Box size={10} /> 3D 星图
                        </button>
                      </span>
                    )}
                    {detailView === '2d' && <span className="subtle">样本占比 / %</span>}
                  </span>
                </div>
                {detailView === '3d' && galaxyData ? (
                  <div className="chart-galaxy-wrap">
                    <Suspense fallback={<span className="galaxy-loading">正在点亮时间宇宙…</span>}>
                      <TimeGalaxy3D data={galaxyData} onSelectPeriod={jumpToPeriod} onUnavailable={handle3DUnavailable} />
                    </Suspense>
                    <button
                      className="galaxy-immersive-btn"
                      type="button"
                      onClick={() => setImmersive3D(true)}
                    >
                      <Maximize2 size={13} /> 进入沉浸式星图
                    </button>
                  </div>
                ) : labels.length ? (
                  <>
                    <div className="chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 20, right: 20, bottom: 5, left: -22 }}
                          onClick={(e: any) => {
                            if (e?.activeTooltipIndex != null) {
                              const i = Number(e.activeTooltipIndex)
                              if (research.periods[i]) {
                                setPeriodIndex(i)
                                setOpinionFilter('')
                              }
                            }
                          }}
                        >
                          <defs>
                            {labels.map((label, i) => (
                              <linearGradient
                                id={`opinion-gradient-${i}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                                key={label}
                              >
                                <stop
                                  offset="0%"
                                  stopColor={COLORS[i % COLORS.length]}
                                  stopOpacity={1}
                                />
                                <stop
                                  offset="100%"
                                  stopColor={COLORS[i % COLORS.length]}
                                  stopOpacity={0.72}
                                />
                              </linearGradient>
                            ))}
                          </defs>
                          <CartesianGrid vertical={false} stroke="#eeedf4" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#858397' }}
                          />
                          <YAxis
                            type="number"
                            domain={[0, 100]}
                            ticks={[0, 25, 50, 75, 100]}
                            tickFormatter={(v) => `${v}%`}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#858397' }}
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [
                              `${Number(value).toFixed(1)}%`,
                              name,
                            ]}
                            contentStyle={{
                              borderRadius: 12,
                              border: '1px solid #eeedf4',
                              fontSize: 12,
                            }}
                          />
                          {labels.map((label, i) => (
                            <Bar
                              key={label}
                              dataKey={`v${i}`}
                              name={label}
                              stackId="opinion"
                              isAnimationActive={false}
                              fill={`url(#opinion-gradient-${i})`}
                              maxBarSize={56}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="legend">
                      {labels.map((label, i) => (
                        <span key={label}>
                          <i
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          {label}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="chart-empty">
                    <Layers3 size={28} />
                    <p>完成第一个阶段的分析后，观点分布会出现在这里。</p>
                  </div>
                )}
                <p className="chart-footnote">
                  占比按去重后的样本数量计算。空白表示无数据或尚未分析，不代表没有相关观点。
                </p>
              </section>
              <div className="period-tabs">
                {research.periods.map((p, i) => (
                  <button
                    className={periodIndex === i ? 'active' : ''}
                    key={p.label}
                    onClick={() => {
                      setPeriodIndex(i)
                      setOpinionFilter('')
                    }}
                  >
                    {p.status === 'done' ? (
                      <Check size={13} />
                    ) : (
                      <Clock3 size={13} />
                    )}
                    {p.label}
                    <small>{p.evidence.length}</small>
                  </button>
                ))}
              </div>
              {period && (
                <div className="detail-grid" id="period-detail">
                  {dominant && (
                    <section
                      className="panel dominant-focus full-span"
                      style={{ '--focus': dominant.color } as CSSProperties}
                    >
                      <div className="dominant-top">
                        <span className="dominant-flag">{period?.label} 中心观点</span>
                        <span className="dominant-count">
                          {dominant.evidenceIds.length}/{period?.evidence.length} 条 · 占 {dominantShare}%
                        </span>
                      </div>
                      <h3 className="dominant-title">{dominant.label}</h3>
                      <p className="dominant-summary">{dominant.summary}</p>
                      <span className="dominant-track">
                        <span className="dominant-bar" style={{ width: `${dominantShare}%` }} />
                      </span>
                    </section>
                  )}
                  <section className="panel period-analysis">
                    <IconLabel>{period.label} / 阶段观点</IconLabel>
                    <h2>这一时期，人们怎么看？</h2>
                    <p>{period.summary || '等待分析这一时间段。'}</p>
                    {period.warnings?.map((warning) => (
                      <div key={warning} className="sample-note">
                        {warning}
                      </div>
                    ))}
                    {period.saturated && (
                      <div className="sample-note">
                        本阶段有搜索达到 {research.input.searchSource === 'global' ? 20 : 10} 条上限，样本可能未完整覆盖。
                      </div>
                    )}
                    <button
                      className={`opinion all ${!opinionFilter ? 'active' : ''}`}
                      onClick={() => setOpinionFilter('')}
                    >
                      全部样本 <span>{period.evidence.length}</span>
                    </button>
                    {period.opinions.map((o, i) => (
                      <button
                        key={`${o.label}-${i}`}
                        className={`opinion ${opinionFilter === o.label ? 'active' : ''}`}
                        onClick={() => setOpinionFilter(o.label)}
                      >
                        <div>
                          <strong>{o.label}</strong>
                          <span>{o.evidenceIds.length} 条</span>
                        </div>
                        <p>{o.summary}</p>
                      </button>
                    ))}
                  </section>
                  <section className="evidence-list">
                    <div className="evidence-title">
                      <BookOpen size={16} />
                      <h2>回到原文</h2>
                      <span>搜索摘要</span>
                    </div>
                    {period.evidence
                      .filter(
                        (e) =>
                          !opinionFilter ||
                          period.opinions.some(
                            (o) =>
                              o.label === opinionFilter &&
                              o.evidenceIds.includes(e.id),
                          ),
                      )
                      .map((e) => (
                        <article className="evidence panel" key={e.id}>
                          <div className="source-meta">
                            <span>{research.input.searchSource === 'global' ? new URL(e.url).hostname : '知乎'} · {e.author || '匿名作者'}</span>
                            <time>
                              {new Date(e.time * 1000).toLocaleDateString(
                                'zh-CN',
                                { timeZone: 'Asia/Shanghai' },
                              )}
                            </time>
                          </div>
                          <h3>{e.title}</h3>
                          <p>{e.text}</p>
                          <footer>
                            <span>{e.votes} 赞同 · 采集时数值</span>
                            <button
                              className="text-button"
                              onClick={() =>
                                void action(() => api.openSource(e.url))
                              }
                            >
                              查看来源 <ArrowUpRight size={14} />
                            </button>
                          </footer>
                        </article>
                      ))}
                    {!period.evidence.length && (
                      <div className="empty panel">
                        <Search size={26} />
                        <p>这里还没有可展示的样本。</p>
                      </div>
                    )}
                  </section>
                </div>
              )}
              <div className="method-note">
                <Database size={16} />
                <p>
                  日期使用接口的 EditTime
                  字段；历史版本不可验证。观点依据当前搜索摘要生成，不能据此还原当年的原始全文。
                </p>
              </div>
            </>
          )}
        </div>
      </main>
      <Dialog.Root open={immersive3D} onOpenChange={setImmersive3D}>
        <Dialog.Portal>
          <Dialog.Overlay className="galaxy-stage-overlay" />
          <Dialog.Content className="galaxy-stage" aria-describedby={undefined}>
            <Dialog.Title className="sr-only">沉浸式观点时间宇宙</Dialog.Title>
            <div className="galaxy-stage-grid" aria-hidden="true" />
            <div className="galaxy-stage-header">
              <div className="stage-brand">
                <span className="stage-brand-mark"><Orbit size={20} /></span>
                <span><strong>ZH-TIMEMACHINE</strong><small>PERSPECTIVE OBSERVATORY</small></span>
              </div>
              <div className="stage-live"><i /> LIVE RENDER <span>60 FPS TARGET</span></div>
              <Dialog.Close asChild>
                <button className="stage-close" type="button" aria-label="退出沉浸式视图">
                  <X size={18} /> ESC
                </button>
              </Dialog.Close>
            </div>
            <div className="galaxy-stage-copy">
              {galaxyData ? (
                <>
                  <span>OPINION EVOLUTION / {galaxyData.periods[0]?.label}—{galaxyData.periods[galaxyData.periods.length - 1]?.label}</span>
                  <h2>{galaxyData.question.length > 18 ? galaxyData.question.slice(0, 18) + '…' : galaxyData.question}</h2>
                  <p>每个节点是一年的群体判断：颜色=主导立场，大小=样本量，点击可跳转到该年证据。</p>
                </>
              ) : (
                <>
                  <span>OPINION EVOLUTION / 2020—2026</span>
                  <h2>穿越观点的<br /><em>时间引力场</em></h2>
                  <p>每个发光节点代表一次叙事转折。拖拽改变观察角度，滚轮穿越时间尺度。</p>
                </>
              )}
            </div>
            {galaxyData && (
              <div className="stage-metrics">
                <span><small>SAMPLES</small><strong>{galaxyData.totalSamples}</strong></span>
                <span><small>PERIODS</small><strong>{galaxyData.periods.length}</strong></span>
                <span><small>SOURCES</small><strong>ZHIHU</strong></span>
              </div>
            )}
            <Suspense fallback={<span className="stage-loading">正在构建沉浸宇宙…</span>}>
              <TimeGalaxy3D immersive data={galaxyData} onSelectPeriod={(i) => { jumpToPeriod(i); setImmersive3D(false) }} onUnavailable={handle3DUnavailable} />
            </Suspense>
            <div className="stage-instructions">
              <span><MousePointer2 size={13} /> 拖拽旋转</span>
              <span>SCROLL / ZOOM</span>
              <span>选择时间节点查看信号</span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {providerForm && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setProviderForm(null)
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="modal-backdrop" />
            <Dialog.Content className="modal panel">
              <div className="panel-heading">
                <Dialog.Title asChild>
                  <h2>{providerForm.id ? '编辑供应商' : '添加模型供应商'}</h2>
                </Dialog.Title>
                <button
                  className="icon-button"
                  aria-label="关闭"
                  onClick={() => setProviderForm(null)}
                >
                  <X size={20} />
                </button>
              </div>
              <Dialog.Description className="subtle">
                填写服务地址、模型名称和你自己的 API Key。
              </Dialog.Description>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void action(async () => {
                    await api.saveProvider(providerForm)
                    setProviderForm(null)
                    setNotice('供应商已保存')
                  })
                }}
              >
                <label>
                  显示名称
                  <input
                    autoFocus
                    required
                    maxLength={60}
                    value={providerForm.name}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  接口地址（Base URL）
                  <input
                    type="url"
                    required
                    value={providerForm.baseURL}
                    onChange={(e) =>
                      setProviderForm({
                        ...providerForm,
                        baseURL: e.target.value,
                      })
                    }
                  />
                  <small>
                    例如 https://api.deepseek.com；兼容服务通常以 /v1 结尾。
                  </small>
                </label>
                <label>
                  模型名称
                  <input
                    required
                    maxLength={120}
                    value={providerForm.model}
                    onChange={(e) =>
                      setProviderForm({
                        ...providerForm,
                        model: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  API Key
                  <input
                    type="password"
                    autoComplete="off"
                    required={!providerForm.id}
                    value={providerForm.key}
                    onChange={(e) =>
                      setProviderForm({ ...providerForm, key: e.target.value })
                    }
                    placeholder={
                      providerForm.id ? '留空保留已保存的密钥' : '输入 API Key'
                    }
                  />
                </label>
                <div className="modal-footer">
                  <Button type="button" onClick={() => setProviderForm(null)}>
                    取消
                  </Button>
                  <Button kind="primary" type="submit" disabled={busy}>
                    保存供应商 <Check size={16} />
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  )
}
