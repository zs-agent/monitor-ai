'use client'

// localStorage 支撑的状态：首帧用默认值（避免服务端渲染与客户端水合不一致），挂载后再读盘。
// 用于短名单与保存视图这类"本机偏好"——不引入后端表。
import { useCallback, useEffect, useState } from 'react'

export function useLocalStore<T>(key: string, initial: T, validate?: (value: unknown) => value is T) {
  const [value, setValue] = useState<T>(initial)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        const valid = validate ? validate(parsed) : Array.isArray(initial) ? Array.isArray(parsed) && parsed.every(x => typeof x === 'string') : typeof parsed === typeof initial
        if (valid) setValue(parsed as T)
      }
    } catch {
      // 解析失败/隐私模式：保持默认值即可
    }
    setLoaded(true)
  // initial and validator describe the storage schema; a key change reloads it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // 配额满：内存里仍生效
      }
      return resolved
    })
  }, [key])

  return [value, update, loaded] as const
}

/** 短名单键：`vendor:anthropic` / `model:kimi-k2` */
export type ShortlistKey = string

export function shortlistKey(kind: 'vendor' | 'model', id: string): ShortlistKey {
  return `${kind}:${id}`
}

export function parseShortlistKey(key: ShortlistKey): { kind: string; id: string } {
  const [kind, ...rest] = key.split(':')
  return { kind, id: rest.join(':') }
}
