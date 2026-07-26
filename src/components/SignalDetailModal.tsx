'use client'

import type { Signal } from '@/types/signal'
import type { ClusteredSignal } from '@/lib/clustering'
import { type Locale } from '@/lib/i18n'

function timeAgo(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return locale === 'zh' ? `${m}分钟前` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return locale === 'zh' ? `${h}小时前` : `${h}h ago`
  return locale === 'zh' ? `${Math.floor(h / 24)}天前` : `${Math.floor(h / 24)}d ago`
}

export default function SignalDetailModal({ signal, locale, onClose }: { signal: Signal | ClusteredSignal | null; locale: Locale; onClose: () => void }) {
  if (!signal) { return null }

  const catsZh = { models: '模型', products: '产品', industry: '产业', papers: '论文', tips: '实战' }
  const catsEn = { models: 'Models', products: 'Products', industry: 'Industry', papers: 'Papers', tips: 'Tips' }
  const cats = locale === 'zh' ? catsZh : catsEn

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-[#12121a] border border-[#1e1e2e] rounded-xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl" onClick={function(e) { e.stopPropagation() }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e2e]">
          <div className="flex items-center gap-2">
            <span className={signal.importance >= 4 ? 'w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse-slow' : 'w-2 h-2 rounded-full bg-[#06b6d4]'} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b8ba0]">
              {locale === 'zh' ? '信号详情' : 'Signal Detail'}
            </span>
          </div>
          <button onClick={onClose} className="text-[#5c5c72] hover:text-[#e5e5e5] transition-colors">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <h2 className="text-sm font-medium leading-relaxed text-[#e5e5e5]">{signal.title}</h2>
          <p className="text-xs leading-relaxed text-[#8b8ba0]">{signal.summary}</p>

          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[#5c5c72] mb-0.5">{locale === 'zh' ? '信源' : 'Source'}</div>
              <div className="text-[#e5e5e5]">{signal.source}</div>
              {'sourceUrl' in signal && signal.sourceUrl && (
                <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#06b6d4] underline mt-1 block text-[10px] truncate">
                  {signal.sourceUrl}
                </a>
              )}
            </div>
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[#5c5c72] mb-0.5">{locale === 'zh' ? '时间' : 'Time'}</div>
               <div className="text-[#e5e5e5] font-mono">{timeAgo(signal.publishedAt, locale)}</div>
            </div>
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[#5c5c72] mb-0.5">{locale === 'zh' ? '分类' : 'Category'}</div>
              <div className="text-[#e5e5e5] capitalize">{cats[signal.category as keyof typeof cats] || signal.category}</div>
            </div>
            <div className="bg-[#0c0c14] rounded-lg p-3">
              <div className="text-[#5c5c72] mb-0.5">{locale === 'zh' ? '重要度' : 'Importance'}</div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map(function(_, i) {
                  return <div key={i} className={i < signal.importance ? 'w-3 h-1 rounded-full bg-[#06b6d4]' : 'w-3 h-1 rounded-full bg-[#1e1e2e]'} />
                })}
              </div>
            </div>
             <div className="col-span-2 bg-[#0c0c14] rounded-lg p-3">
               <div className="text-[#5c5c72] mb-0.5">{locale === 'zh' ? '标签' : 'Tags'}</div>
               <div className="flex flex-wrap gap-1">
                 {('tags' in signal ? signal.tags : []).map(function(tag, i) {
                   return <span key={i} className="px-1.5 py-0.5 text-[9px] rounded bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20">{tag}</span>
                 })}
              </div>
           </div>

           {/* Cluster items - show individual sources */}
           {'isCluster' in signal && signal.isCluster && signal.clusterItems && (
             <div className="bg-[#0c0c14] rounded-lg p-3 mt-2">
               <div className="text-[10px] text-[#5c5c72] mb-1.5 font-semibold uppercase tracking-[0.08em]">
                 {locale === 'zh' ? '聚合来源' : 'Cluster Sources'} ({signal.clusterItems.length})
               </div>
               <div className="space-y-1 max-h-32 overflow-y-auto">
                 {signal.clusterItems.map((item, i) => (
                   <div key={i} className="flex items-start gap-2 text-[10px] py-0.5 border-b border-[#1e1e2e]/30 last:border-0">
                     <span className="w-1 h-1 mt-1 rounded-full bg-[#06b6d4]/50 shrink-0" />
                     <div className="flex-1 min-w-0">
                       <div className="text-[#e5e5e5] truncate">{item.title}</div>
                       <div className="text-[#5c5c72] text-[9px]">{item.source} · {(item as any).importance}/5</div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
         </div>
        </div>

        <div className="px-5 py-3 border-t border-[#1e1e2e] flex items-center justify-between">
          <span className="text-[9px] text-[#5c5c72]">{'sourcesCount' in signal ? signal.sourcesCount : signal.sourceCount} {locale === 'zh' ? '个信源' : 'sources'}</span>
          <a
            href={signal.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] px-3 py-1.5 rounded-lg bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors"
          >
            {locale === 'zh' ? '查看原文 →' : 'View Source →'}
          </a>
        </div>
      </div>
    </div>
  )
}
