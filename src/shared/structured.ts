import { z } from 'zod'

export interface ModelReply {
  text: string
  tokens: number
  finishReason?: string
}
export class ModelFormatError extends Error {
  constructor(stage: string, reason: string) {
    super(
      `${stage}未完成：${reason}（已自动重试一次）。样本已保存，可继续分析。`,
    )
    this.name = 'ModelFormatError'
  }
}
export function parseModelJSON(text: string): unknown {
  const trimmed = text
    .replace(/^\uFEFF/, '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    /* Accept explanatory prose only around a complete JSON object. */
  }
  const start = trimmed.indexOf('{')
  if (start < 0) throw new SyntaxError('没有完整 JSON 对象')
  let depth = 0,
    quoted = false,
    escaped = false
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (quoted) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') quoted = false
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) {
      const rest = trimmed
        .slice(i + 1)
        .replace(/```/g, '')
        .trim()
      if (rest.includes('{')) throw new SyntaxError('存在多个 JSON 对象')
      return JSON.parse(trimmed.slice(start, i + 1))
    }
  }
  throw new SyntaxError('JSON 对象不完整')
}
export async function structuredRequest<T>(options: {
  schema: z.ZodType<T>
  prompt: string
  stage: string
  maxTokens: number
  signal: AbortSignal
  request: (prompt: string, maxTokens: number) => Promise<ModelReply>
  onReply: (reply: ModelReply) => void
  onRetry: (reason: string) => void
}): Promise<T> {
  let reason = '',
    correction = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    options.signal.throwIfAborted()
    const reply = await options.request(
      options.prompt + correction,
      attempt ? Math.min(options.maxTokens * 2, 8000) : options.maxTokens,
    )
    options.onReply(reply)
    options.signal.throwIfAborted()
    if (reply.finishReason === 'length') reason = '模型输出达到长度上限而被截断'
    else {
      try {
        const parsed = options.schema.safeParse(parseModelJSON(reply.text))
        if (parsed.success) return parsed.data
        reason =
          '字段不符合约定：' +
          parsed.error.issues
            .slice(0, 4)
            .map((issue) => `${issue.path.join('.')} (${issue.code})`)
            .join('、')
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e
        reason = reply.text.trim()
          ? '模型未返回完整有效的 JSON'
          : '模型返回了空内容'
      }
    }
    if (!attempt) {
      options.onRetry(reason)
      correction = `\n上次输出未通过校验：${reason}。请重新根据原始样本生成完整 JSON，严格遵守字段类型、数量和长度限制，简明作答。不要解释、不要代码围栏，不要遗漏结束括号。`
    }
  }
  throw new ModelFormatError(options.stage, reason)
}
