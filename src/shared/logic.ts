import type { Period, Opinion, Evidence } from './types.ts'

// Calendar boundaries use Asia/Shanghai (UTC+8), independent of OS timezone.
export function dayTimestamp(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('请选择有效日期')
  const ms = Date.parse(`${date}T00:00:00+08:00`)
  if (
    !Number.isFinite(ms) ||
    new Date(ms + 28800000).toISOString().slice(0, 10) !== date
  )
    throw new Error('请选择有效日期')
  return ms / 1000
}
export function makePeriods(
  start: string,
  end: string,
  grain: 'year' | 'quarter' | 'month',
): Period[] {
  let from = dayTimestamp(start)
  const until = dayTimestamp(end) + 86400
  if (until <= from) throw new Error('结束日期不能早于开始日期')
  const result: Period[] = []
  while (from < until) {
    const d = new Date(from * 1000 + 28800000)
    const y = d.getUTCFullYear(),
      m = d.getUTCMonth()
    const next =
      grain === 'year'
        ? Date.UTC(y + 1, 0, 1)
        : grain === 'quarter'
          ? Date.UTC(y, Math.floor(m / 3) * 3 + 3, 1)
          : Date.UTC(y, m + 1, 1)
    const to = Math.min(next / 1000 - 28800, until) - 1
    result.push({
      label:
        grain === 'year'
          ? `${y}`
          : grain === 'quarter'
            ? `${y} Q${Math.floor(m / 3) + 1}`
            : `${y}-${String(m + 1).padStart(2, '0')}`,
      from,
      to,
      evidence: [],
      summary: '',
      opinions: [],
      status: 'pending',
      saturated: false,
    })
    if (result.length > 24)
      throw new Error('一次最多分析 24 个时间段，请缩小范围或增大粒度')
    from = to + 1
  }
  return result
}
export function validateBaseURL(value: string): string {
  const u = new URL(value)
  if (u.username || u.password || u.search || u.hash)
    throw new Error('接口地址不能包含凭证、查询参数或片段')
  if (
    u.protocol !== 'https:' &&
    !(
      u.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    )
  )
    throw new Error('请使用 HTTPS，或本机 HTTP 地址')
  return u.toString().replace(/\/$/, '')
}
export function cleanOpinions(
  opinions: Opinion[],
  evidence: Evidence[],
): Opinion[] {
  const valid = new Set(evidence.map((x) => x.id)),
    used = new Set<string>()
  return opinions
    .map((opinion) => ({
      ...opinion,
      evidenceIds: opinion.evidenceIds.filter((id) => {
        if (!valid.has(id) || used.has(id)) return false
        used.add(id)
        return true
      }),
    }))
    .filter((x) => x.evidenceIds.length > 0)
}
export function sourceAllowed(url: string): boolean {
  try {
    const u = new URL(url)
    return (
      u.protocol === 'https:' &&
      !u.username &&
      !u.password &&
      (u.hostname === 'zhihu.com' || u.hostname.endsWith('.zhihu.com'))
    )
  } catch {
    return false
  }
}
