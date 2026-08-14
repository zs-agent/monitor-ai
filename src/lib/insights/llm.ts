import { fetchWithTimeout } from '@/lib/fetch-with-timeout'

interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

/** 调用 OpenAI 兼容 /chat/completions（默认 DeepSeek）。失败或无 key 返回 null（由 pipeline 降级）。 */
export async function generateInsight(
  category: string,
  titles: string[],
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const model = process.env.MODEL_NAME || 'deepseek-chat'

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        '你是 AI 行业情报分析师。基于用户给出的当日信号标题，用简体中文输出一段 80-150 字的综述，' +
        '提炼今日该类别最重要的动态、趋势与看点。不要逐条罗列，要归纳。不要编造标题之外的信息。',
    },
    {
      role: 'user',
      content: `类别：${category}\n今日信号标题：\n${titles.map(t => `- ${t}`).join('\n')}`,
    },
  ]

  const res = await fetchWithTimeout(
    `${baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        max_tokens: 300,
      }),
    },
    20000,
  )
  if (!res.ok) return null

  const body = await res.json()
  const text: string | undefined = body?.choices?.[0]?.message?.content
  return typeof text === 'string' && text.trim() ? text.trim() : null
}
