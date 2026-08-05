'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import PanelBase from './PanelBase'
import { PRESET_INDICATORS, COMMON_COUNTRIES } from '@/types/indicator'
import type { IndicatorMeta, IndicatorValue, IndicatorQuery, IndicatorResponse, CountryOption } from '@/types/indicator'
import type { Locale } from '@/lib/i18n'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface Props {
  locale: Locale
}

const T = (zh: string, en: string, locale: Locale) => locale === 'zh' ? zh : en

// 动态当前年份，避免硬编码
const CURRENT_YEAR = new Date().getFullYear()

// Number formatting
function fmt(n: number | null, unit: string): string {
  if (n === null || n === undefined) return '—'
  if (unit.includes('US$') || unit === 'current US$') {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
    return n.toLocaleString()
  }
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 })
  return n.toFixed(2)
}

export default function IndicatorsPanel({ locale }: Props) {
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorMeta>(PRESET_INDICATORS[0])
  const [selectedCountries, setSelectedCountries] = useState<string[]>(['USA', 'CHN'])
  const [yearStart, setYearStart] = useState(2010)
  const [yearEnd, setYearEnd] = useState(CURRENT_YEAR)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [data, setData] = useState<IndicatorResponse | null>(null)
  const [chartLoading, setChartLoading] = useState(false)    // 仅图表区域加载
  const [chartError, setChartError] = useState<string | null>(null)  // 仅图表区域错误
  const searchRef = useRef<HTMLDivElement>(null)

  const indicator = selectedIndicator?.id || ''

  // Fetch data (异步，不阻塞面板展示)
  const fetchData = useCallback(async () => {
    if (!indicator || selectedCountries.length === 0) return
    setChartLoading(true)
    setChartError(null)
    try {
      const url = `/api/indicators?indicator=${indicator}&countries=${selectedCountries.join(',')}&yearStart=${yearStart}&yearEnd=${yearEnd}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setChartError(e instanceof Error ? e.message : T('数据加载失败', 'Failed to load data', locale))
    } finally {
      setChartLoading(false)
    }
  }, [indicator, selectedCountries, yearStart, yearEnd, locale])

  useEffect(() => { fetchData() }, [fetchData])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return PRESET_INDICATORS
    const q = searchQuery.toLowerCase()
    return PRESET_INDICATORS.filter(i =>
      i.id.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.topic.some(t => t.toLowerCase().includes(q))
    )
  }, [searchQuery])

  // Country toggle
  const toggleCountry = (code: string) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  // Chart data: transform values to { year, USA: val, CHN: val, ... }
  const chartData = useMemo(() => {
    if (!data?.values) return []
    const yearMap = new Map<number, { year: number; [key: string]: number | null }>()
    for (const v of data.values) {
      if (!yearMap.has(v.year)) yearMap.set(v.year, { year: v.year })
      const row = yearMap.get(v.year)!
      row[v.country] = v.value
    }
    return Array.from(yearMap.values()).sort((a, b) => a.year - b.year)
  }, [data])

  // Table columns
  const years = useMemo(() => {
    if (!data?.values.length) return []
    const ySet = new Set<number>()
    for (const v of data.values) ySet.add(v.year)
    return Array.from(ySet).sort((a, b) => b - a)
  }, [data])

  // Selected country name map
  const countryNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const c of COMMON_COUNTRIES) m[c.code] = locale === 'zh' ? c.nameZh : c.name
    return m
  }, [locale])

  // Missing info text
  const missingText = useMemo(() => {
    if (!data?.missingInfo) return ''
    const parts = data.missingInfo
      .filter(m => m.missingYears.length > 0)
      .map(m => `${countryNameMap[m.country] || m.country}: ${m.missingYears.join(', ')}`)
    return parts.join('; ')
  }, [data, countryNameMap])

  // CSV download
  const downloadCSV = () => {
    if (!data?.values.length) return
    const headers = ['Country', 'Year', 'Value']
    const rows = data.values.map(v => [v.countryName, v.year.toString(), v.value !== null ? v.value.toString() : ''])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${indicator}-data.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const meta = data?.meta || selectedIndicator

  // Max value for marker scaling
  const maxVal = useMemo(() => {
    const vals = data?.values.map(v => v.value).filter((v): v is number => v !== null) || []
    return vals.length > 0 ? Math.max(...vals) : 1
  }, [data])

  return (
    <PanelBase
      id="macro-indicators"
      title={T('宏观指标', 'Macro Indicators', locale)}
      dataBadge="live"
    >
      {/* Controls Row */}
      <div className="flex flex-wrap gap-2 mb-3 items-start">
        {/* Indicator Select */}
        <div className="relative" ref={searchRef}>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-[11px] bg-[#1a1a2e] border border-[#2a2a3e] rounded px-2 py-1.5 text-[#e5e5e5] hover:border-[#06b6d4] transition-colors min-w-[200px] text-left"
          >
            {meta?.name || indicator}
          </button>
          {showSearch && (
            <div className="absolute top-full left-0 mt-1 w-[320px] bg-[#12121a] border border-[#2a2a3e] rounded shadow-xl z-50 max-h-[280px] overflow-y-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={T('搜索指标...', 'Search indicators...', locale)}
                className="w-full px-2 py-1.5 text-[11px] bg-[#0a0a0f] border-b border-[#2a2a3e] text-[#e5e5e5] outline-none"
                autoFocus
              />
              {searchResults.map(ind => (
                <button
                  key={ind.id}
                  onClick={() => { setSelectedIndicator(ind); setShowSearch(false); setSearchQuery('') }}
                  className={`w-full text-left px-2 py-1.5 text-[11px] hover:bg-[#1a1a2e] transition-colors ${indicator === ind.id ? 'text-[#06b6d4]' : 'text-[#8b8ba0]'}`}
                >
                  <div className="font-medium">{ind.name}</div>
                  <div className="text-[9px] text-[#5c5c72]">{ind.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Country Multi-Select */}
        <div className="flex flex-wrap gap-1">
          {COMMON_COUNTRIES.map(c => (
            <button
              key={c.code}
              onClick={() => toggleCountry(c.code)}
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                selectedCountries.includes(c.code)
                  ? 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]'
                  : 'bg-[#1a1a2e] border-[#2a2a3e] text-[#5c5c72] hover:border-[#5c5c72]'
              }`}
            >
              {locale === 'zh' ? c.nameZh : c.name}
            </button>
          ))}
        </div>

        {/* Year Range */}
        <div className="flex items-center gap-1.5 text-[10px] text-[#5c5c72]">
          <span>{T('年份', 'Year', locale)}:</span>
          <input
            type="number"
            min={1990}
            max={CURRENT_YEAR}
            value={yearStart}
            onChange={e => { const v = parseInt(e.target.value); if (v >= 1990 && v <= yearEnd) setYearStart(v) }}
            className="w-14 bg-[#1a1a2e] border border-[#2a2a3e] rounded px-1.5 py-0.5 text-[#e5e5e5] text-[10px] outline-none"
          />
          <span>—</span>
          <input
            type="number"
            min={yearStart}
            max={CURRENT_YEAR}
            value={yearEnd}
            onChange={e => { const v = parseInt(e.target.value); if (v >= yearStart && v <= CURRENT_YEAR) setYearEnd(v) }}
            className="w-14 bg-[#1a1a2e] border border-[#2a2a3e] rounded px-1.5 py-0.5 text-[#e5e5e5] text-[10px] outline-none"
          />
        </div>
      </div>

      {/* Indicator Metadata Row */}
      {meta && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3 text-[10px] bg-[#12121a] rounded p-2 border border-[#1e1e2e]">
          <div><span className="text-[#5c5c72]">{T('指标', 'Indicator', locale)}</span><br /><span className="text-[#e5e5e5]">{meta.name}</span></div>
          <div><span className="text-[#5c5c72]">{T('代码', 'Code', locale)}</span><br /><span className="text-[#e5e5e5]">{meta.id}</span></div>
          <div><span className="text-[#5c5c72]">{T('来源', 'Source', locale)}</span><br /><span className="text-[#e5e5e5]">{meta.sourceOrganization}</span></div>
          <div><span className="text-[#5c5c72]">{T('单位', 'Unit', locale)}</span><br /><span className="text-[#e5e5e5]">{meta.unit || '—'}</span></div>
          <div><span className="text-[#5c5c72]">{T('年份', 'Year Range', locale)}</span><br /><span className="text-[#e5e5e5]">{yearStart}–{yearEnd}</span></div>
          <div><span className="text-[#5c5c72]">{T('更新', 'Updated', locale)}</span><br /><span className="text-[#e5e5e5]">{data?.fetchedAt?.slice(0, 10) || '—'}</span></div>
        </div>
      )}

      {/* Map + Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-3 mb-3">
        {/* Simple Map: colored circles by country */}
        <div className="bg-[#0c0c14] rounded border border-[#1e1e2e] p-2 min-h-[200px] relative">
          <div className="text-[10px] font-semibold text-[#5c5c72] uppercase tracking-wider mb-2">{T('国家分布', 'Country Distribution', locale)}</div>
          <div className="flex flex-wrap gap-2">
            {selectedCountries.map(code => {
              const lastVal = data?.values?.filter(v => v.country === code && v.value !== null).sort((a, b) => b.year - a.year)[0]
              return (
                <div key={code} className="flex-1 min-w-[120px] bg-[#12121a] rounded p-2 border border-[#1e1e2e]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-medium text-[#e5e5e5]">{countryNameMap[code] || code}</span>
                  </div>
                  <div className="text-[20px] font-light text-[#06b6d4]">
                    {lastVal ? fmt(lastVal.value, meta?.unit || '') : '—'}
                  </div>
                  <div className="text-[9px] text-[#5c5c72]">
                    {lastVal ? `${T('最新', 'Latest', locale)}: ${lastVal.year}` : T('无数据', 'No data', locale)}
                  </div>
                  {/* Value bar */}
                  {lastVal?.value !== null && lastVal?.value !== undefined && (
                    <div className="mt-1 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#06b6d4] rounded-full transition-all"
                        style={{ width: `${((lastVal.value as number) / maxVal) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-[#0c0c14] rounded border border-[#1e1e2e] p-2 min-h-[200px]">
          <div className="text-[10px] font-semibold text-[#5c5c72] uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>{T('趋势', 'Trend', locale)}</span>
            {chartLoading && <span className="text-[9px] text-[#06b6d4] animate-pulse">{T('加载中...', 'Loading...', locale)}</span>}
            {chartError && !chartLoading && (
              <button onClick={fetchData} className="text-[9px] text-[#f59e0b] hover:text-[#06b6d4] transition-colors">
                {T('重试', 'Retry', locale)}
              </button>
            )}
          </div>
          {chartError ? (
            <div className="flex flex-col items-center justify-center h-[220px] text-[11px] text-[#5c5c72]">
              <span className="text-[#f59e0b] mb-1">{chartError}</span>
              <button onClick={fetchData} className="text-[#06b6d4] hover:text-[#0891b2] transition-colors text-[10px]">
                {T('点击重试', 'Click to retry', locale)}
              </button>
            </div>
          ) : chartLoading ? (
            <div className="flex items-center justify-center h-[220px] text-[11px] text-[#5c5c72]">
              <span className="animate-pulse">{T('正在获取全球数据...', 'Fetching global data...', locale)}</span>
            </div>
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#5c5c72' }} stroke="#2a2a3e" />
                <YAxis tick={{ fontSize: 10, fill: '#5c5c72' }} stroke="#2a2a3e" />
                <Tooltip
                  contentStyle={{ background: '#12121a', border: '1px solid #2a2a3e', borderRadius: 4, fontSize: 11 }}
                  labelStyle={{ color: '#e5e5e5' }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {selectedCountries.map((code, i) => {
                  const colors = ['#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#a855f7', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#e11d48', '#8b5cf6', '#0ea5e9']
                  return (
                    <Line
                      key={code}
                      type="monotone"
                      dataKey={code}
                      name={countryNameMap[code] || code}
                      stroke={colors[i % colors.length]}
                      strokeWidth={1.5}
                      dot={{ r: 2 }}
                      connectNulls
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[220px] text-[11px] text-[#5c5c72]">
              {T('选择指标和国家以查看趋势', 'Select indicator and countries to view trend', locale)}
            </div>
          )}
        </div>
      </div>

      {/* Table + Download */}
      <div className="bg-[#0c0c14] rounded border border-[#1e1e2e] p-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold text-[#5c5c72] uppercase tracking-wider">
            {T('国家对比表', 'Country Comparison', locale)}
          </div>
          <button
            onClick={downloadCSV}
            className="text-[10px] px-2 py-0.5 bg-[#1a1a2e] border border-[#2a2a3e] rounded text-[#8b8ba0] hover:text-[#06b6d4] hover:border-[#06b6d4] transition-colors"
          >
            {T('下载 CSV', 'Download CSV', locale)}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left py-1 pr-2 text-[#5c5c72] font-medium">{T('国家', 'Country', locale)}</th>
                {years.map(y => <th key={y} className="text-right py-1 px-1.5 text-[#5c5c72] font-medium">{y}</th>)}
              </tr>
            </thead>
            <tbody>
              {selectedCountries.map(code => {
                const countryVals = data?.values?.filter(v => v.country === code) || []
                const valMap = new Map(countryVals.map(v => [v.year, v.value]))
                return (
                  <tr key={code} className="border-b border-[#1e1e2e]/50 hover:bg-[#12121a] transition-colors">
                    <td className="py-1 pr-2 text-[#e5e5e5] font-medium">{countryNameMap[code] || code}</td>
                    {years.map(y => (
                      <td key={y} className={`text-right py-1 px-1.5 ${valMap.get(y) !== null && valMap.get(y) !== undefined ? 'text-[#8b8ba0]' : 'text-[#5c5c72] italic'}`}>
                        {valMap.get(y) !== null && valMap.get(y) !== undefined ? fmt(valMap.get(y) as number, meta?.unit || '') : '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {missingText && (
          <div className="mt-1 text-[9px] text-[#f59e0b]">
            {T('缺失数据', 'Missing data', locale)}: {missingText}
          </div>
        )}
      </div>
    </PanelBase>
  )
}
