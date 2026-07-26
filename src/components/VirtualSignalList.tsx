'use client'

import { useRef, useEffect, useState, useCallback, type ReactNode } from 'react'

const BATCH_SIZE = 8
const OVERSCAN = 4

export default function VirtualSignalList<T extends { id: string }>({
  items,
  renderItem,
  estimateHeight = 180,
}: {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  estimateHeight?: number
}) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: BATCH_SIZE + OVERSCAN })
  const containerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || items.length <= BATCH_SIZE + OVERSCAN) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
       setVisibleRange(prev => {
         const nextEnd = Math.min(prev.end + BATCH_SIZE, items.length)
         if (nextEnd === prev.end) return prev
         return { start: prev.start, end: nextEnd }
       })
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [items.length])

  if (items.length === 0) return null

  const visible = items.slice(visibleRange.start, visibleRange.end)

  return (
    <div ref={containerRef}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visible.map((item, i) => (
          <div key={item.id} className="min-h-[180px] animate-fade-in" style={{ animationDelay: `${(i % BATCH_SIZE) * 60}ms` }}>
            {renderItem(item, i)}
          </div>
        ))}
      </div>
      {visibleRange.end < items.length && (
        <div ref={sentinelRef} className="h-4" />
      )}
    </div>
  )
}
