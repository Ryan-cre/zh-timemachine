import { z } from 'zod'

const integer = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^-?\d+$/)
      .transform(Number),
  ])
  .pipe(z.number().int().safe())
const contentID = z.union([
  z.string().min(1),
  z.number().int().safe().transform(String),
])
const optionalText = z
  .string()
  .nullish()
  .transform((value) => value ?? '')
const itemSchema = z.object({
  ContentID: contentID,
  ContentType: z.string().min(1),
  Title: optionalText,
  ContentText: z.string().min(1),
  Url: z.string().url(),
  EditTime: integer.pipe(z.number().nonnegative()),
  VoteUpCount: integer.nullish().transform((value) => value ?? 0),
  AuthorName: optionalText,
})
export type ZhihuItem = z.infer<typeof itemSchema>
export function parseZhihuResponse(raw: unknown): {
  items: ZhihuItem[]
  rawCount: number
  warnings: string[]
} {
  // Error payloads may contain Data:null. Read Code before validating success data.
  const envelope = z
    .object({ Code: integer, Data: z.unknown().optional() })
    .safeParse(raw)
  if (!envelope.success)
    throw new Error('知乎响应缺少有效的 Code 状态码，请稍后重试')
  const code = envelope.data.Code
  if (code !== 0) {
    const messages: Record<number, string> = {
      10001: '知乎搜索参数错误',
      20001: '知乎凭证无效，请检查 Access Secret',
      30001: '知乎调用频率受限，请稍后继续分析',
      90001: '知乎服务暂时不可用，请稍后继续分析',
    }
    throw new Error(`${messages[code] ?? '知乎请求未成功'}（Code ${code}）`)
  }
  const data = z
    .object({
      Items: z.array(z.unknown()).nullable(),
      EmptyReason: z.string().nullish(),
    })
    .safeParse(envelope.data.Data)
  if (!data.success)
    throw new Error('知乎成功响应缺少有效的 Data.Items 列表，请稍后继续分析')
  if (data.data.Items === null && !data.data.EmptyReason?.trim())
    throw new Error('知乎返回了空 Items，但未说明无结果原因，请稍后继续分析')
  const rawItems = data.data.Items ?? [],
    items: ZhihuItem[] = [],
    invalid: string[] = []
  rawItems.forEach((item, index) => {
    const parsed = itemSchema.safeParse(item)
    if (parsed.success) items.push(parsed.data)
    else
      invalid.push(`Items[${index}].${parsed.error.issues[0].path.join('.')}`)
  })
  if (rawItems.length && !items.length)
    throw new Error(
      `知乎返回的 ${rawItems.length} 条内容均缺少有效字段（${invalid.slice(0, 3).join('、')}），无法作为研究样本`,
    )
  return {
    items,
    rawCount: rawItems.length,
    warnings: invalid.length
      ? [
          `有 ${invalid.length} 条搜索结果缺少有效内容、ID 或时间等字段，已排除。`,
        ]
      : [],
  }
}
