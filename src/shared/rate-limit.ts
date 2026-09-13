export interface RateState {
  nextAt: number
  retryAt: number
  strikes: number
}

// Conservative client policy; the API documentation does not specify a quota.
export function rateLimited(state: RateState, retryAfter: string | null, now: number): RateState {
  const seconds = retryAfter?.trim() ? Number(retryAfter) : NaN
  const serverAt = Number.isFinite(seconds)
    ? now + Math.max(0, seconds) * 1000
    : Date.parse(retryAfter ?? '')
  const delay = Math.min(60_000 * 2 ** Math.min(state.strikes, 4), 900_000)
  return {
    ...state,
    strikes: state.strikes + 1,
    retryAt: Math.max(now + delay, Number.isFinite(serverAt) ? serverAt : 0),
  }
}

export function assertRateReady(state: RateState, now: number) {
  if (state.retryAt > now)
    throw new Error(`知乎调用频率受限（Code 30001 / HTTP 429），本地冷却剩余 ${Math.ceil((state.retryAt - now) / 1000)} 秒；请于 ${new Date(state.retryAt).toLocaleTimeString()} 后继续分析。冷却结束不代表知乎限制已解除。`)
}
