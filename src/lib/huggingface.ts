export interface HFPaper {
  id: string
  title: string
  url: string
  upvotes: number
  createdAt: string
}

export async function fetchHFPapers(): Promise<HFPaper[]> {
  try {
    const res = await fetch('https://huggingface.co/api/daily_papers')
    if (!res.ok) return []
    const data: any[] = await res.json()
    return data.slice(0, 15).map((p: any) => ({
      id: `hf-${p.id || p.paper?.id || Math.random().toString(36).slice(2)}`,
      title: p.title || p.paper?.title || '',
      url: `https://huggingface.co/papers/${p.id || p.paper?.id || ''}`,
      upvotes: p.upvotes || p.paper?.upvotes || 0,
      createdAt: p.createdAt || p.paper?.createdAt || new Date().toISOString(),
    }))
  } catch {
    return []
  }
}
