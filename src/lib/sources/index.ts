import type { SignalProvider } from './types'
import { hackernewsProvider } from './hackernews'
import { huggingfaceProvider } from './huggingface'
import { githubProvider } from './github'
import { semanticscholarProvider } from './semanticscholar'
import { rssProvider } from './rss'

/** 全部启用的数据源。新增数据源只需在此注册。 */
export const providers: SignalProvider[] = [
  hackernewsProvider,
  huggingfaceProvider,
  githubProvider,
  semanticscholarProvider,
  rssProvider,
]

export type { SignalProvider } from './types'
