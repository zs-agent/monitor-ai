export interface RawItem {
  id: number
  title: string
  url: string
  by: string
  score: number
  descendants: number
  time: number
}

const AI_KEYWORDS = ['ai', 'artificial intelligence', 'machine learning', 'deep learning',
  'gpt', 'claude', 'llm', 'chatgpt', 'openai', 'anthropic', 'neural', 'transformer',
  'model', 'language model', 'agent', 'copilot', 'gemini', 'llama', 'mistral']

function isAiRelated(title: string): boolean {
  const lower = title.toLowerCase()
  return AI_KEYWORDS.some(kw => lower.includes(kw))
}

const HN_API = 'https://hacker-news.firebaseio.com/v0'

export async function fetchHNTopStories(): Promise<RawItem[]> {
  const idsRes = await fetch(`${HN_API}/topstories.json`)
  const ids: number[] = await idsRes.json()
  const topIds = ids.slice(0, 60)

  const items: RawItem[] = []
  for (let i = 0; i < topIds.length; i += 6) {
    const batch = topIds.slice(i, i + 6)
    const results = await Promise.allSettled(
      batch.map(id => fetch(`${HN_API}/item/${id}.json`).then(r => r.json()))
    )
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && !r.value.deleted) {
        items.push(r.value)
      }
    }
  }

  return items
    .filter(item => isAiRelated(item.title))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
}
