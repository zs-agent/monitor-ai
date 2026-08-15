import { fetchWithTimeout } from '@/lib/fetch-with-timeout'
import { GLOBAL_COUNTRY } from './ai-indicators'
import type { IndicatorMeta, IndicatorValue, IndicatorQuery, IndicatorResponse } from '@/types/indicator'
import { PRESET_INDICATORS } from '@/types/indicator'
import snapshotData from '@/data/wb-snapshot.json'

const WB_API = 'https://api.worldbank.org/v2'
const TIMEOUT = 20000

interface WBResponse {
  indicator: { id: string; value: string }
  country: { id: string; value: string }
  countryiso3code: string
  date: string
  value: number | null
  unit: string
  obs_status: string
  decimal: number
}

interface WBMetaResponse {
  id: string
  name: string
  sourceNote: string
  sourceOrganization: string
  unit: string
  topic: { id: string; value: string }[]
  lastUpdated: string
}

/** 从本地快照读取数据（部署到无梯子服务器时也能正常工作） */
function loadFromSnapshot(query: IndicatorQuery): { values: IndicatorValue[] } | null {
  const entry = (snapshotData as any).indicators?.[query.indicator]
  if (!entry?.values?.length) return null

  const countrySet = new Set(query.countries)
  const values: IndicatorValue[] = entry.values
    .filter((v: any) => countrySet.has(v.country) && v.year >= query.yearStart && v.year <= query.yearEnd)
    .map((v: any) => ({
      country: v.country,
      countryName: v.countryName,
      year: v.year,
      value: v.value,
      indicator: query.indicator,
    }))

  if (values.length === 0) return null
  return { values }
}

/** 从 World Bank API 获取指定指标数据（在线回退） */
async function fetchFromAPI(query: IndicatorQuery): Promise<{ values: IndicatorValue[]; meta: IndicatorMeta | null }> {
  const countries = query.countries.join(';')
  const dateStr = `${query.yearStart}:${query.yearEnd}`
  const url = `${WB_API}/country/${countries}/indicator/${query.indicator}?format=json&date=${dateStr}&per_page=5000`

  const [dataRes, meta] = await Promise.all([
    fetchWithTimeout(url, {}, TIMEOUT)
      .then(async (r) => {
        if (!r.ok) throw new Error(`World Bank API HTTP ${r.status}`)
        const body = await r.json()
        if (!Array.isArray(body) || body.length < 2) throw new Error('Invalid World Bank API response')
        return (body[1] || []) as WBResponse[]
      }),
    fetchIndicatorMeta(query.indicator).catch(() => null),
  ])

  const values: IndicatorValue[] = dataRes
    .filter((v: WBResponse) => v.countryiso3code)
    .map((v: WBResponse) => ({
      country: v.countryiso3code,
      countryName: v.country?.value || v.countryiso3code,
      year: parseInt(v.date, 10),
      value: v.value,
      indicator: query.indicator,
    }))

  return { values, meta }
}

/** 获取指标数据：优先本地快照，快照不全则尝试在线 API */
export async function fetchIndicatorData(query: IndicatorQuery): Promise<IndicatorResponse> {
  // 1. AI 原生指标走独立数据源
  if (query.indicator.startsWith('AI.')) {
    const { fetchAIIndicatorData } = await import('./ai-indicators')
    const values = await fetchAIIndicatorData(query.indicator, query.countries, query.yearStart, query.yearEnd)
    const meta = PRESET_INDICATORS.find(i => i.id === query.indicator) || null
    return buildResponse(query, values, meta)
  }

  // 2. 本地快照
  const snapshot = loadFromSnapshot(query)
  const meta = PRESET_INDICATORS.find(i => i.id === query.indicator) || null

  if (snapshot) {
    return buildResponse(query, snapshot.values, meta)
  }

  // 2. 在线 API 回退
  try {
    const api = await fetchFromAPI(query)
    return buildResponse(query, api.values, api.meta || meta)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    // 返回空数据 + 错误标记（组件会降级展示）
    return buildResponse(query, [], meta, msg)
  }
}

function buildResponse(
  query: IndicatorQuery,
  values: IndicatorValue[],
  meta: IndicatorMeta | null,
  error?: string,
): IndicatorResponse {
  // 全球口径指标返回 WLD 单序列：缺失信息按 WLD 计算，不再把请求的国家逐列报成全部缺失
  const globalScope = values.some(v => v.country === GLOBAL_COUNTRY) || !!meta?.globalScope
  const scopeCountries = globalScope ? [GLOBAL_COUNTRY] : query.countries
  const missingInfo = scopeCountries.map(code => {
    const countryValues = values.filter(v => v.country === code)
    const presentYears = new Set(countryValues.map(v => v.year))
    const allYears: number[] = []
    for (let y = query.yearStart; y <= query.yearEnd; y++) allYears.push(y)
    const missingYears = allYears.filter(y => !presentYears.has(y))
    return { country: code, missingYears }
  })
  return {
    meta: meta && globalScope ? { ...meta, globalScope: true } : meta,
    values,
    missingInfo,
    fetchedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  }
}

/** 获取指标元数据（优先本地，其次 API） */
export async function fetchIndicatorMeta(code: string): Promise<IndicatorMeta | null> {
  const local = PRESET_INDICATORS.find(i => i.id === code)
  try {
    const res = await fetchWithTimeout(`${WB_API}/indicator/${code}?format=json`, {}, 8000)
    if (!res.ok) return local || null
    const body = await res.json()
    if (!Array.isArray(body) || body.length < 2) return local || null
    const raw: WBMetaResponse = body[1]?.[0]
    if (!raw) return local || null
    return {
      id: raw.id,
      name: raw.name || local?.name || code,
      description: raw.sourceNote || local?.description || '',
      sourceNote: raw.sourceNote || '',
      sourceOrganization: raw.sourceOrganization || local?.sourceOrganization || 'World Bank',
      unit: raw.unit || local?.unit || '',
      topic: (raw.topic || []).map((t: any) => t.value),
      lastUpdated: raw.lastUpdated || '',
    }
  } catch {
    return local || null
  }
}

/** 搜索指标（按名称/描述匹配本地预设指标） */
export function searchIndicators(query: string): IndicatorMeta[] {
  const q = query.toLowerCase()
  return PRESET_INDICATORS.filter(i =>
    i.id.toLowerCase().includes(q) ||
    i.name.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q) ||
    i.topic.some(t => t.toLowerCase().includes(q))
  )
}
