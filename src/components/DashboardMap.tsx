'use client'

import { useEffect, useState, useMemo, useRef, memo } from 'react'
import { type Locale } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import type { Signal } from '@/types/signal'
import { AI_HUBS, type AiLocation } from '@/data/ai-locations'
import { ECOSYSTEM_ENTITIES, TECH_CONNECTIONS, ECO_CONN_LABELS, ECO_CONN_COLORS, ECO_SUBTYPE_LABELS } from '@/data/agent-ecosystem'
import PanelBase from './PanelBase'

interface Props { locale: Locale; signals?: Signal[]; onSelectEntity?: (entity: AiLocation) => void }

const AUX_HUBS: AiLocation[] = [
  { id: 'google-sf', name: 'Google AI', nameZh: '谷歌AI', lat: 37.789, lng: -122.390, type: 'company', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 4, models: [] },
  { id: 'deepmind-ldn', name: 'DeepMind HQ', nameZh: 'DeepMind总部', lat: 51.5355, lng: -0.1257, type: 'research', country: 'UK', city: 'London', cityZh: '伦敦', importance: 4, models: [] },
  { id: 'nyu', name: 'NYU', nameZh: '纽约大学', lat: 40.729, lng: -73.996, type: 'research', country: 'US', city: 'New York', cityZh: '纽约', importance: 2, models: [] },
  { id: 'austin', name: 'Austin AI Hub', nameZh: '奥斯汀AI', lat: 30.267, lng: -97.743, type: 'company', country: 'US', city: 'Austin', cityZh: '奥斯汀', importance: 2, models: [] },
  { id: 'seattle', name: 'Seattle AI', nameZh: '西雅图AI', lat: 47.608, lng: -122.335, type: 'company', country: 'US', city: 'Seattle', cityZh: '西雅图', importance: 3, models: [] },
  { id: 'bengaluru', name: 'Bengaluru AI', nameZh: '班加罗尔AI', lat: 12.971, lng: 77.594, type: 'company', country: 'IN', city: 'Bengaluru', cityZh: '班加罗尔', importance: 2, models: [] },
  { id: 'tokyo-ai', name: 'Tokyo AI', nameZh: '东京AI', lat: 35.676, lng: 139.650, type: 'research', country: 'JP', city: 'Tokyo', cityZh: '东京', importance: 2, models: [] },
  { id: 'seoul-ai', name: 'Seoul AI', nameZh: '首尔AI', lat: 37.566, lng: 126.978, type: 'company', country: 'KR', city: 'Seoul', cityZh: '首尔', importance: 2, models: [] },
  { id: 'singapore', name: 'Singapore AI', nameZh: '新加坡AI', lat: 1.352, lng: 103.819, type: 'company', country: 'SG', city: 'Singapore', cityZh: '新加坡', importance: 2, models: [] },
  { id: 'telaviv', name: 'Tel Aviv AI', nameZh: '特拉维夫AI', lat: 32.085, lng: 34.781, type: 'company', country: 'IL', city: 'Tel Aviv', cityZh: '特拉维夫', importance: 2, models: [] },
  { id: 'dubai', name: 'Dubai AI', nameZh: '迪拜AI', lat: 25.204, lng: 55.270, type: 'company', country: 'AE', city: 'Dubai', cityZh: '迪拜', importance: 2, models: [] },
  { id: 'montreal', name: 'Mila Lab', nameZh: 'Mila实验室', lat: 45.501, lng: -73.567, type: 'research', country: 'CA', city: 'Montreal', cityZh: '蒙特利尔', importance: 3, models: [] },
  { id: 'zurich', name: 'ETH AI Center', nameZh: 'ETH AI中心', lat: 47.376, lng: 8.541, type: 'research', country: 'CH', city: 'Zurich', cityZh: '苏黎世', importance: 2, models: [] },
  { id: 'amsterdam', name: 'Amsterdam AI', nameZh: '阿姆斯特丹AI', lat: 52.367, lng: 4.904, type: 'research', country: 'NL', city: 'Amsterdam', cityZh: '阿姆斯特丹', importance: 2, models: [] },
  { id: 'stockholm', name: 'Stockholm AI', nameZh: '斯德哥尔摩AI', lat: 59.329, lng: 18.068, type: 'research', country: 'SE', city: 'Stockholm', cityZh: '斯德哥尔摩', importance: 2, models: [] },
  { id: 'mit-csail', name: 'MIT CSAIL', nameZh: 'MIT CSAIL', lat: 42.3601, lng: -71.0942, type: 'research', country: 'US', city: 'Cambridge', cityZh: '剑桥', importance: 3, models: [] },
  { id: 'stanford-hai', name: 'Stanford HAI', nameZh: '斯坦福HAI', lat: 37.4275, lng: -122.1697, type: 'research', country: 'US', city: 'Stanford', cityZh: '斯坦福', importance: 3, models: [] },
  { id: 'uc-berkeley', name: 'UC Berkeley BAIR', nameZh: '伯克利BAIR', lat: 37.8719, lng: -122.2585, type: 'research', country: 'US', city: 'Berkeley', cityZh: '伯克利', importance: 3, models: [] },
  { id: 'chicago', name: 'Chicago AI', nameZh: '芝加哥AI', lat: 41.878, lng: -87.629, type: 'research', country: 'US', city: 'Chicago', cityZh: '芝加哥', importance: 2, models: [] },
]

const ALL_HUBS: AiLocation[] = [...AI_HUBS, ...AUX_HUBS, ...ECOSYSTEM_ENTITIES]

/** 技术关系连线 → 与既有 CONNECTIONS 同构 */
const TECH_CONNECTION_ROWS = TECH_CONNECTIONS.map(c => ({
  from: c.from,
  to: c.to,
  type: c.type,
  labelEn: ECO_CONN_LABELS[c.type].en,
  labelZh: ECO_CONN_LABELS[c.type].zh,
}))

const CONNECTIONS = [
  { from: 'openai', to: 'deepseek', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'google-dm', to: 'tsinghua-air', type: 'collab', labelEn: 'Research', labelZh: '研究合作' },
  { from: 'openai', to: 'anthropic', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'microsoft-ai', to: 'nvidia', type: 'partner', labelEn: 'Partnership', labelZh: '合作伙伴' },
  { from: 'google-dm', to: 'nvidia', type: 'partner', labelEn: 'Partnership', labelZh: '合作伙伴' },
  { from: 'baidu', to: 'alibaba-damo', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'zhipu', to: 'tsinghua-air', type: 'collab', labelEn: 'Research', labelZh: '研究合作' },
  { from: 'deepseek', to: 'alibaba-damo', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'mistral', to: 'huggingface', type: 'collab', labelEn: 'Ecosystem', labelZh: '生态合作' },
  { from: 'openai', to: 'microsoft-ai', type: 'partner', labelEn: 'Partnership', labelZh: '合作伙伴' },
  { from: 'meta-ai', to: 'stability', type: 'collab', labelEn: 'Open Source', labelZh: '开源协作' },
  { from: 'nvidia', to: 'sense-time', type: 'partner', labelEn: 'Chip Supply', labelZh: '芯片供应' },
  { from: 'google-dm', to: 'deepmind-ldn', type: 'partner', labelEn: 'Internal', labelZh: '内部协作' },
  { from: 'moonshot', to: 'minimax', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'anthropic', to: 'cohere', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'openai', to: 'meta-ai', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'bytedance', to: 'tencent', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'alibaba-damo', to: 'tencent', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'mistral', to: 'google-dm', type: 'collab', labelEn: 'Research', labelZh: '研究合作' },
  { from: 'tsinghua-air', to: 'mit-csail', type: 'collab', labelEn: 'Academic', labelZh: '学术交流' },
  { from: 'openai', to: 'google-dm', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'moonshot', to: 'deepseek', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'zhipu', to: 'moonshot', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'nvidia', to: 'openai', type: 'partner', labelEn: 'Chip Supply', labelZh: '芯片供应' },
  { from: 'nvidia', to: 'google-dm', type: 'partner', labelEn: 'Chip Supply', labelZh: '芯片供应' },
  { from: 'nvidia', to: 'tsmc', type: 'partner', labelEn: 'Manufacturing', labelZh: '代工制造' },
  { from: 'amd', to: 'tsmc', type: 'partner', labelEn: 'Manufacturing', labelZh: '代工制造' },
  { from: 'intel', to: 'tsmc', type: 'partner', labelEn: 'Manufacturing', labelZh: '代工制造' },
  { from: 'qualcomm', to: 'tsmc', type: 'partner', labelEn: 'Manufacturing', labelZh: '代工制造' },
  { from: 'nvidia', to: 'sk-hynix', type: 'partner', labelEn: 'HBM Supply', labelZh: 'HBM供应' },
  { from: 'nvidia', to: 'micron', type: 'partner', labelEn: 'Memory Supply', labelZh: '内存供应' },
  { from: 'samsung', to: 'nvidia', type: 'partner', labelEn: 'Memory Supply', labelZh: '内存供应' },
  { from: 'asml', to: 'tsmc', type: 'partner', labelEn: 'Equipment', labelZh: '设备供应' },
  { from: 'asml', to: 'samsung', type: 'partner', labelEn: 'Equipment', labelZh: '设备供应' },
  { from: 'asml', to: 'intel', type: 'partner', labelEn: 'Equipment', labelZh: '设备供应' },
  { from: 'hisilicon', to: 'smic', type: 'partner', labelEn: 'Manufacturing', labelZh: '代工制造' },
  { from: 'cambricon', to: 'smic', type: 'partner', labelEn: 'Manufacturing', labelZh: '代工制造' },
  { from: 'amd', to: 'intel', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'nvidia', to: 'amd', type: 'compete', labelEn: 'Competition', labelZh: '竞争' },
  { from: 'tsmc', to: 'samsung', type: 'compete', labelEn: 'Process Race', labelZh: '制程竞赛' },
  { from: 'samsung', to: 'sk-hynix', type: 'compete', labelEn: 'Memory Race', labelZh: '内存竞争' },
  { from: 'cxmt', to: 'samsung', type: 'compete', labelEn: 'DRAM Race', labelZh: 'DRAM竞争' },
  { from: 'ymtc', to: 'micron', type: 'compete', labelEn: 'NAND Race', labelZh: 'NAND竞争' },
  { from: 'nvidia', to: 'hisilicon', type: 'compete', labelEn: 'AI Chip Race', labelZh: 'AI芯片竞争' },
  { from: 'intel', to: 'amd', type: 'compete', labelEn: 'CPU Race', labelZh: 'CPU竞争' },
]

function getHubById(id: string): AiLocation | undefined {
  return ALL_HUBS.find(h => h.id === id)
}

/** 全部连线：既有竞争/合作/研究 + 生态技术关系 */
const ALL_CONNECTIONS = [...CONNECTIONS, ...TECH_CONNECTION_ROWS]

const CITY_MAP: Record<string, [number, number]> = {
  'san francisco': [37.7749, -122.4194], 'sf': [37.7749, -122.4194],
  'mountain view': [37.4221, -122.0841], 'menlo park': [37.4848, -122.1482],
  'palo alto': [37.4419, -122.1430], 'seattle': [47.6062, -122.3321],
  'redmond': [47.6409, -122.1292], 'new york': [40.7128, -74.0060], 'nyc': [40.7128, -74.0060],
  'boston': [42.3601, -71.0589], 'cambridge': [42.3736, -71.1097],
  'los angeles': [34.0522, -118.2437], 'beijing': [39.9042, 116.4074],
  'shanghai': [31.2304, 121.4737], 'hangzhou': [30.2741, 120.1551],
  'shenzhen': [22.5431, 114.0579], 'guangzhou': [23.1291, 113.2644],
  'tokyo': [35.6762, 139.6503], 'seoul': [37.5665, 126.9780],
  'london': [51.5074, -0.1278], 'paris': [48.8566, 2.3522],
  'berlin': [52.5200, 13.4050], 'toronto': [43.6532, -79.3832],
  'montreal': [45.5017, -73.5673], 'singapore': [1.3521, 103.8198],
  'tel aviv': [32.0853, 34.7818], 'dubai': [25.2048, 55.2708],
  'bangalore': [12.9716, 77.5946], 'bengaluru': [12.9716, 77.5946],
  'zurich': [47.3769, 8.5417], 'amsterdam': [52.3676, 4.9041],
  'stockholm': [59.3293, 18.0686], 'sydney': [-33.8688, 151.2093],
  'taipei': [25.0330, 121.5654], 'hong kong': [22.3193, 114.1694],
  'moscow': [55.7558, 37.6173], 'austin': [30.2672, -97.7431],
  'chicago': [41.8781, -87.6298],
  'mumbai': [19.0760, 72.8777], 'delhi': [28.6139, 77.2090],
  'sao paulo': [-23.5505, -46.6333], 'nairobi': [-1.2921, 36.8219],
  'hsinchu': [24.808, 120.996], 'suwon': [37.263, 127.028],
  'icheon': [37.272, 127.442], 'veldhoven': [51.409, 5.396],
  'hefei': [31.860, 117.280], 'wuhan': [30.520, 114.420],
  'santa clara': [37.354, -121.955], 'san diego': [32.896, -117.193],
  'san jose': [37.339, -121.894], 'boise': [43.603, -116.219],
}

const ENTITY_MAP: Record<string, [number, number]> = {
  'openai': [37.7749, -122.4194], 'anthropic': [37.7935, -122.3929],
  'google': [37.4221, -122.0841], 'deepmind': [51.5355, -0.1257],
  'meta': [37.4848, -122.1482], 'microsoft': [47.6409, -122.1292],
  'nvidia': [37.3709, -121.9688], 'deepseek': [30.2741, 120.1551],
  'zhipu': [39.9042, 116.4074], 'kimi': [39.958, 116.452],
  'minimax': [31.2304, 121.4737], 'alibaba': [30.251, 120.138],
  'baidu': [40.016, 116.305], 'bytedance': [39.956, 116.330],
  'tencent': [22.5431, 114.0579], 'claude': [37.7935, -122.3929],
  'gpt': [37.7749, -122.4194], 'chatgpt': [37.7749, -122.4194],
  'llama': [37.4848, -122.1482], 'gemini': [37.4221, -122.0841],
  'copilot': [47.6409, -122.1292], 'amazon': [47.6189, -122.3430],
  'apple': [37.3349, -122.0090], 'xai': [37.779, -122.417],
  'midjourney': [37.773, -122.417], 'runway': [40.7580, -73.9855],
  'stability': [51.5074, -0.1278], 'hugging': [48.8588, 2.350],
  'perplexity': [37.793, -122.407], 'cohere': [43.6532, -79.3832],
  'databricks': [37.805, -122.408], 'cerebras': [37.342, -121.883],
  'sambanova': [37.405, -122.115], 'together': [37.807, -122.271],
  'eleuther': [40.7286, -73.9923], 'berkeley': [37.8719, -122.2585],
  'mit': [42.3601, -71.0942], 'stanford': [37.4275, -122.1697],
  'tsinghua': [40.002, 116.329], 'oxford': [51.7548, -1.2544],
  'kuaishou': [39.983, 116.305], 'xiaomi': [39.984, 116.317],
  '01.ai': [39.981, 116.313],
  'amd': [37.367, -121.968], 'intel': [37.387, -121.963],
  'qualcomm': [32.896, -117.193], 'broadcom': [37.322, -121.898],
  'micron': [43.603, -116.219], 'tsmc': [24.808, 120.996],
  'samsung': [37.263, 127.028], 'sk hynix': [37.272, 127.442],
  'asml': [51.409, 5.396], 'cambricon': [39.985, 116.320],
  'hygon': [39.989, 116.315], 'hisilicon': [22.550, 114.060],
  'smic': [31.240, 121.625], 'cxmt': [31.860, 117.280],
  'ymtc': [30.520, 114.420],
}

function hashId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) / 0x7FFFFFFF
}

function extractSignalLocations(signals?: Signal[]): Array<{ lat: number; lng: number; title: string; source: string; id: string }> {
  if (!signals) return []
  const locs: Array<{ lat: number; lng: number; title: string; source: string; id: string }> = []
  const seen = new Set<string>()
  // 词边界匹配（避免 "meta" 命中 "metamorphosis" 等子串误报）
  const hasWord = (text: string, word: string): boolean => {
    try { return new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`, 'i').test(text) } catch { return text.includes(word) }
  }

  for (const signal of signals) {
    if (seen.has(signal.id)) continue
    const text = `${signal.title} ${signal.summary}`.toLowerCase()

    for (const [entity, coords] of Object.entries(ENTITY_MAP)) {
      if (hasWord(text, entity)) {
        seen.add(signal.id)
        locs.push({ lat: coords[0] + (hashId(signal.id) - 0.5) * 0.1, lng: coords[1] + (hashId(signal.id) - 0.5) * 0.1, title: signal.title.slice(0, 60), source: signal.source, id: signal.id })
        break
      }
    }
    if (seen.has(signal.id)) continue

    for (const [city, coords] of Object.entries(CITY_MAP)) {
      if (text.includes(city)) {
        seen.add(signal.id)
        locs.push({ lat: coords[0] + (hashId(signal.id) - 0.5) * 0.2, lng: coords[1] + (hashId(signal.id) - 0.5) * 0.2, title: signal.title.slice(0, 60), source: signal.source, id: signal.id })
        break
      }
    }
  }
  return locs.slice(0, 25)
}

const TYPE_LABELS: Record<string, { en: string; zh: string }> = {
  company: { en: 'Company', zh: '公司' },
  research: { en: 'Research', zh: '研究机构' },
  datacenter: { en: 'Data Center', zh: '数据中心' },
  conference: { en: 'Conference', zh: '会议' },
  chip: { en: 'Chip/Hardware', zh: '芯片/硬件' },
  lab: { en: 'Model Lab', zh: '大模型厂商' },
  'agent-project': { en: 'Agent Project', zh: 'Agent 开源项目' },
  'agent-platform': { en: 'Agent Platform', zh: '企业级 Agent 平台' },
  infra: { en: 'Infrastructure', zh: '基础设施' },
}

function HubPopupContent({
  displayName, displayCity, country, color, typeDisplay, importance,
  description, models, connected, nearbySignals, isZh, ecosystem, onSelectEntity,
}: {
  displayName: string; displayCity: string; country: string;
  color: string; typeDisplay: string; importance: number;
  description?: string; models: any[]; connected: any[]; nearbySignals: number; isZh: boolean;
  ecosystem?: AiLocation['ecosystem']; onSelectEntity?: () => void;
}) {
  const importanceDots = '●'.repeat(importance) + '○'.repeat(5 - importance)
  const subtypeLabel = ecosystem?.subtype ? (ECO_SUBTYPE_LABELS[ecosystem.subtype as keyof typeof ECO_SUBTYPE_LABELS] || { en: ecosystem.subtype, zh: ecosystem.subtype }) : null
  return (
    <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.5, minWidth: 240, maxWidth: 320 }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: 2 }}>{displayName}</div>
      <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontSize: '10px' }}>{displayCity}, {country}{ecosystem?.note ? ` · ${ecosystem.note}` : ''}</div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '8px', padding: '2px 8px', borderRadius: 3, background: `${color}20`, color, border: `1px solid ${color}40` }}>{typeDisplay}</span>
        {subtypeLabel && <span style={{ fontSize: '8px', padding: '2px 8px', borderRadius: 3, background: `${color}14`, color: `${color}cc`, border: `1px solid ${color}30` }}>{isZh ? subtypeLabel.zh : subtypeLabel.en}</span>}
        <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>{isZh ? '重要度' : 'Importance'}: {importanceDots}</span>
      </div>
      {description ? <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: 8, padding: '6px 8px', background: 'var(--bg-card-2)', borderRadius: 4 }}>📋 {description}</div> : null}
      {models.length > 0 ? (
        <div style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>{isZh ? '旗下模型' : 'Models'} ({models.length})</div>
          {models.map((m: any, i: number) => (
            <div key={i} style={{ fontSize: '9px', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{m.name}</span>
                <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>{m.version}</span>
                <span style={{ fontSize: '7px', color: 'var(--accent)', marginLeft: 'auto' }}>{m.releaseYear}</span>
              </div>
              {m.description ? <div style={{ fontSize: '7px', color: 'var(--text-muted)', marginTop: 1 }}>{m.description}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
      {connected.length > 0 ? (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>{isZh ? '关系连线' : 'Connections'} ({connected.length})</div>
          {connected.slice(0, 5).map((c: any, i: number) => (
            <div key={i} style={{ fontSize: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0' }}>
              <span style={{ width: 8, height: 1, background: CONN_COLORS[c.type] || '#555', display: 'inline-block', flexShrink: 0 }} />
              <span>{isZh ? c.otherNameZh : c.otherName}</span>
              <span style={{ color: CONN_COLORS[c.type] || '#555' }}>· {isZh ? (CONN_LABELS[c.type]?.zh || c.type) : (CONN_LABELS[c.type]?.en || c.type)}</span>
            </div>
          ))}
          {connected.length > 5 ? <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>...+{connected.length - 5} {isZh ? '条更多' : 'more'}</div> : null}
        </div>
      ) : null}
      {nearbySignals > 0 ? (
        <div style={{ marginTop: 4, fontSize: '9px', color: '#f59e0b', borderTop: '1px solid var(--border)', paddingTop: 5 }}>
          📍 {nearbySignals} {isZh ? '条附近信号' : 'nearby signals'}
        </div>
      ) : null}
      {(ecosystem || onSelectEntity) && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
          {onSelectEntity && (
            <button
              onClick={onSelectEntity}
              style={{ fontSize: '9px', padding: '3px 10px', borderRadius: 4, background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', cursor: 'pointer' }}
            >
              {isZh ? '查看详情并联动' : 'Details & related'}
            </button>
          )}
          {ecosystem?.github && (
            <a href={`https://github.com/${ecosystem.github}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '9px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              GitHub ↗
            </a>
          )}
          {ecosystem?.home && (
            <a href={ecosystem.home} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '9px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
              Home ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

const CONN_COLORS: Record<string, string> = { ...ECO_CONN_COLORS, compete: '#ff4444', partner: '#06b6d4', collab: '#a78bfa' }
const CONN_LABELS: Record<string, { en: string; zh: string }> = { ...ECO_CONN_LABELS, compete: { en: 'Competition', zh: '竞争' }, partner: { en: 'Partnership', zh: '合作伙伴' }, collab: { en: 'Research', zh: '研究合作' } }
const HUB_COLORS: Record<string, string> = {
  company: '#06b6d4', research: '#a78bfa', datacenter: '#f59e0b', conference: '#34d399', chip: '#06b6d4',
  lab: '#38bdf8', 'agent-project': '#34d399', 'agent-platform': '#fb923c', infra: '#94a3b8',
}

type MapLayer = 'company' | 'research' | 'chip' | 'datacenter' | 'lab' | 'agent-project' | 'agent-platform' | 'infra' | 'signal' | 'connection'

const LAYER_OPTIONS: { key: MapLayer; label: Record<string, string>; color: string }[] = [
  { key: 'lab', label: { en: 'Model Labs', zh: '大模型厂商' }, color: '#38bdf8' },
  { key: 'agent-project', label: { en: 'Agent Projects', zh: 'Agent 开源' }, color: '#34d399' },
  { key: 'agent-platform', label: { en: 'Agent Platforms', zh: 'Agent 平台' }, color: '#fb923c' },
  { key: 'infra', label: { en: 'Infrastructure', zh: '基础设施' }, color: '#94a3b8' },
  { key: 'company', label: { en: 'Company', zh: '公司' }, color: '#06b6d4' },
  { key: 'research', label: { en: 'Research', zh: '研究机构' }, color: '#a78bfa' },
  { key: 'chip', label: { en: 'Chip/HW', zh: '芯片/硬件' }, color: '#06b6d4' },
  { key: 'datacenter', label: { en: 'Data Center', zh: '数据中心' }, color: '#f59e0b' },
  { key: 'signal', label: { en: 'Signal', zh: '信号' }, color: '#f59e0b' },
  { key: 'connection', label: { en: 'Connections', zh: '关系连线' }, color: '#ff4444' },
]

const DashboardMap = memo(function DashboardMap({ locale, signals, onSelectEntity }: Props) {
  const { theme } = useTheme()
  const [MapComponents, setMapComponents] = useState<{
    MapContainer: React.ComponentType<any>
    TileLayer: React.ComponentType<any>
    CircleMarker: React.ComponentType<any>
    Polyline: React.ComponentType<any>
    Marker: React.ComponentType<any>
    Popup: React.ComponentType<any>
    Tooltip: React.ComponentType<any>
    useMap: () => any
  } | null>(null)
  const [L, setL] = useState<any>(null)
  const [mapLoadError, setMapLoadError] = useState(false)
  const [activeLayers, setActiveLayers] = useState<MapLayer[]>(['lab', 'agent-project', 'agent-platform', 'infra', 'company', 'research', 'signal', 'connection'])
  const [layerOpen, setLayerOpen] = useState(true)

  useEffect(() => {
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
      link.crossOrigin = ''
      document.head.appendChild(link)
    }
    import('react-leaflet').then(mod => {
      setMapComponents({
        MapContainer: mod.MapContainer, TileLayer: mod.TileLayer,
        CircleMarker: mod.CircleMarker, Polyline: mod.Polyline,
        Marker: mod.Marker, Popup: mod.Popup, Tooltip: mod.Tooltip,
        useMap: mod.useMap,
      })
    }).catch((err) => { console.error('Failed to load react-leaflet:', err); setMapLoadError(true) })
    import('leaflet').then(lib => setL(lib)).catch((err) => { console.error('Failed to load leaflet:', err); setMapLoadError(true) })
  }, [])

  const mapWrapRef = useRef<HTMLDivElement>(null)

  // 连线流动动画改为纯 CSS（见 globals.css 的 .dash-flow-line），不再用 JS 定时器驱动重渲染

  const signalLocations = useMemo(() => extractSignalLocations(signals), [signals])
  const connectionLines = useMemo(() =>
    ALL_CONNECTIONS.map(c => {
      const fromHub = getHubById(c.from)
      const toHub = getHubById(c.to)
      if (!fromHub || !toHub) return null
      const label = locale === 'zh' ? c.labelZh : c.labelEn
      return { from: [fromHub.lat, fromHub.lng] as [number, number], to: [toHub.lat, toHub.lng] as [number, number], type: c.type, label }
    }).filter(Boolean) as Array<{ from: [number, number]; to: [number, number]; type: string; label: string }>,
  [locale])

  const getHubConnections = useMemo(() => {
    const map = new Map<string, Array<{ otherName: string; otherNameZh: string; type: string; otherId: string }>>()
    for (const c of ALL_CONNECTIONS) {
      const fromHub = getHubById(c.from)
      const toHub = getHubById(c.to)
      if (!fromHub || !toHub) continue
      if (!map.has(c.from)) map.set(c.from, [])
      if (!map.has(c.to)) map.set(c.to, [])
      map.get(c.from)!.push({ otherName: toHub.name, otherNameZh: toHub.nameZh, type: c.type, otherId: c.to })
      map.get(c.to)!.push({ otherName: fromHub.name, otherNameZh: fromHub.nameZh, type: c.type, otherId: c.from })
    }
    return map
  }, [])

  const midMarkers = useMemo(() =>
    connectionLines.map((conn, i) => {
      const midLat = (conn.from[0] + conn.to[0]) / 2
      const midLng = (conn.from[1] + conn.to[1]) / 2
      return { ...conn, midLat, midLng, index: i }
    }), [connectionLines])

  const toggleLayer = (layer: MapLayer) => {
    setActiveLayers(prev => prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer])
  }

  const selectAllLayers = () => setActiveLayers(LAYER_OPTIONS.map(o => o.key))
  const clearLayers = () => setActiveLayers([])

  const isLayerActive = (layer: MapLayer) => activeLayers.includes(layer)

  // Bounds covering every hub so the default view shows all points
  const allBounds = useMemo<[number, number][]>(
    () => ALL_HUBS.map(h => [h.lat, h.lng] as [number, number]),
    []
  )

  // Controller: keeps wheel events inside the map and fits all points on mount
  const MapController = useMemo(() => {
    if (!MapComponents) return null
    const useMapHook = MapComponents.useMap
    return function Controller({ bounds }: { bounds: [number, number][] }) {
      const map = useMapHook()
      const fittedRef = useRef(false)

      useEffect(() => {
        const container = map.getContainer()
        // Never let the wheel bubble to the page scroller: zoom stays on the map
        const onWheel = (e: WheelEvent) => {
          e.preventDefault()
        }
        container.addEventListener('wheel', onWheel, { passive: false })
        return () => container.removeEventListener('wheel', onWheel)
      }, [map])

      useEffect(() => {
        if (fittedRef.current || bounds.length < 2) return
        fittedRef.current = true
        map.fitBounds(bounds, { padding: [8, 8], animate: false })
      }, [map, bounds])

      return null
    }
  }, [MapComponents])

  if (!MapComponents) {
    return (
      <PanelBase id="map" title={locale === 'zh' ? '全景 AI Agent 生态地图' : 'AI Agent Ecosystem Map'} dataBadge={mapLoadError ? 'unavailable' : 'static'} collapsible className="h-full">
        <div className="h-full min-h-0 flex items-center justify-center">
          {mapLoadError ? (
            <div className="text-center px-4">
              <span className="text-2xl mb-2 block opacity-40">🗺️</span>
              <p className="text-[12px] text-danger">{locale === 'zh' ? '地图组件加载失败' : 'Map failed to load'}</p>
              <p className="text-[10px] text-muted mt-1">{locale === 'zh' ? '请检查网络后刷新页面重试' : 'Check network and refresh'}</p>
            </div>
          ) : (
            <div className="panel-loading"><div className="panel-loading-radar"><div className="panel-radar-dot" /></div><div className="panel-loading-text">{locale === 'zh' ? '加载地图...' : 'Loading map...'}</div></div>
          )}
        </div>
      </PanelBase>
    )
  }

  const { MapContainer, TileLayer, CircleMarker, Polyline, Marker, Popup, Tooltip } = MapComponents

  const filteredHubs = ALL_HUBS.filter(hub => {
    if (hub.type === 'company' && isLayerActive('company')) return true
    if (hub.type === 'research' && isLayerActive('research')) return true
    if (hub.type === 'chip' && isLayerActive('chip')) return true
    if (hub.type === 'datacenter' && isLayerActive('datacenter')) return true
    if (hub.type === 'lab' && isLayerActive('lab')) return true
    if (hub.type === 'agent-project' && isLayerActive('agent-project')) return true
    if (hub.type === 'agent-platform' && isLayerActive('agent-platform')) return true
    if (hub.type === 'infra' && isLayerActive('infra')) return true
    if (hub.type === 'conference') return false
    return false
  })

  const showConnections = isLayerActive('connection')
  const showSignals = isLayerActive('signal')

  return (
    <PanelBase
      id="map"
      title={locale === 'zh' ? '全景 AI Agent 生态地图' : 'AI Agent Ecosystem Map'}
      dataBadge="static"
      collapsible
      className="h-full"
      headerExtra={
        <button
          onClick={() => setLayerOpen(!layerOpen)}
          className="text-[9px] px-2 py-0.5 rounded border border-edge-light text-ink-2 hover:text-accent hover:border-[#06b6d4]/30 transition-colors flex items-center gap-1"
        >
          <span>{locale === 'zh' ? '图层' : 'Layers'}</span>
          <span className="text-[9px]">{layerOpen ? '▲' : '▼'}</span>
        </button>
      }
    >
      <div className="relative z-0 h-full min-h-0">
        <div className="h-full min-h-0" ref={mapWrapRef}>
        <MapContainer
          center={[25, 10]}
          zoom={2}
          minZoom={2}
          maxZoom={10}
          scrollWheelZoom={true}
          maxBounds={[[-85, -180], [85, 180]]}
          maxBoundsViscosity={1}
          worldCopyJump={false}
          style={{ height: '100%', width: '100%', background: 'var(--bg-primary)' }}
          zoomControl={false}
          attributionControl={false}
        >
          {MapController && <MapController bounds={allBounds} />}
          <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url={theme === 'light' ? 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'} />

          {/* Dynamic connection lines */}
          {showConnections && connectionLines.map((conn, i) => {
            const color = CONN_COLORS[conn.type] || '#555'
            const positions: [number, number][] = [conn.from, conn.to]
            return (
              // 柔和底色 + 主流动线（双层，营造光带纵深）
              ([
                <Polyline key={`conn-base-${i}`} positions={positions} pathOptions={{ color, weight: 4, opacity: 0.1 }} />,
                <Polyline key={`conn-flow-${i}`} positions={positions} pathOptions={{ color, weight: 1.6, opacity: 0.7, dashArray: '5 9', className: 'dash-flow-line' }}>
                  <Tooltip direction="center" opacity={0.85}>
                    <span className="text-[9px]">{conn.label}</span>
                  </Tooltip>
                </Polyline>,
              ])
            )
          })}

          {/* Connection line labels */}
          {showConnections && L && midMarkers.map((m, i) => {
            const color = CONN_COLORS[m.type] || '#555'
            const icon = L.divIcon({
              className: '',
              html: `<div style="font-size:7px;color:${color};font-weight:600;white-space:nowrap;pointer-events:none">${m.label}</div>`,
              iconSize: [70, 12],
              iconAnchor: [35, 6],
            })
            return <Marker key={`mid-${i}`} position={[m.midLat, m.midLng]} icon={icon} interactive={false} />
          })}

          {/* AI Hub markers */}
          {filteredHubs.map(hub => {
            const isEco = hub.type === 'lab' || hub.type === 'agent-project' || hub.type === 'agent-platform' || hub.type === 'infra'
            const size = isEco
              ? (hub.importance >= 5 ? 10 : hub.importance >= 4 ? 9 : 7)
              : (hub.importance >= 5 ? 8 : hub.importance >= 4 ? 6 : hub.importance >= 3 ? 4 : 2.5)
            const color = HUB_COLORS[hub.type] || '#06b6d4'
            const connected = getHubConnections.get(hub.id) || []
            const nearbySignals = signalLocations.filter(l =>
              Math.abs(l.lat - hub.lat) < 5 && Math.abs(l.lng - hub.lng) < 5
            ).length
            const isZh = locale === 'zh'
            const displayName = isZh ? hub.nameZh : hub.name
            const displayCity = isZh ? hub.cityZh : hub.city
            const typeLabel = (TYPE_LABELS[hub.type] || { en: hub.type, zh: hub.type })
            const typeDisplay = isZh ? typeLabel.zh : typeLabel.en
            const ecoSubtype = hub.ecosystem?.subtype
              ? (ECO_SUBTYPE_LABELS[hub.ecosystem.subtype as keyof typeof ECO_SUBTYPE_LABELS] || { en: hub.ecosystem.subtype, zh: hub.ecosystem.subtype })
              : null

            return (
              <CircleMarker
                key={hub.id}
                center={[hub.lat, hub.lng]}
                radius={size}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 1,
                  // 高对比描边光晕：深色瓦片用浅色环、浅色瓦片用深色环，任何主题下都清晰
                  color: 'var(--map-halo)',
                  weight: isEco ? 2.5 : 2,
                  opacity: 1,
                }}
                eventHandlers={{
                  click: (e: { target: { openPopup: () => void } }) => e.target.openPopup(),
                }}
              >
                <Popup>
                  <HubPopupContent
                    displayName={displayName}
                    displayCity={displayCity}
                    country={hub.country}
                    color={color}
                    typeDisplay={typeDisplay}
                    importance={hub.importance}
                    description={hub.description}
                    models={hub.models}
                    connected={connected}
                    nearbySignals={nearbySignals}
                    isZh={isZh}
                    ecosystem={hub.ecosystem}
                    onSelectEntity={onSelectEntity ? () => onSelectEntity(hub) : undefined}
                  />
                </Popup>
                <Tooltip direction="top" offset={[0, -size - 5]} opacity={0.9}>
                  <div style={{ fontSize: '10px' }}>
                    <div style={{ fontWeight: 600 }}>{displayName}</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-secondary)' }}>{displayCity} · {typeDisplay}{ecoSubtype ? ` · ${isZh ? ecoSubtype.zh : ecoSubtype.en}` : ''} · {'●'.repeat(hub.importance)}</div>
                    {hub.models.length > 0 && (
                      <div style={{ fontSize: '7px', color: CONN_COLORS.partner }}>
                        {hub.models.length} model{hub.models.length > 1 ? 's' : ''}: {hub.models[0].name}{hub.models.length > 1 ? '...' : ''}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })}

          {/* Signal markers */}
          {showSignals && signalLocations.map(loc => (
              <CircleMarker
                key={loc.id}
                center={[loc.lat, loc.lng]}
                radius={5}
                pathOptions={{ fillColor: '#f59e0b', fillOpacity: 1, color: 'var(--map-halo)', weight: 2, opacity: 1, className: 'map-signal-dot' }}
              eventHandlers={{
                click: (e: { target: { openPopup: () => void } }) => e.target.openPopup(),
              }}
            >
              <Popup>
                <div className="text-xs max-w-52" style={{ color: 'var(--text-primary)', lineHeight: 1.4 }}>
                  <div>{loc.title}</div>
                  <div className="text-accent mt-1 text-[9px]">{loc.source}</div>
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -7]} opacity={0.85}>
                <span className="text-[10px]">{loc.title.slice(0, 25)}...</span>
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        </div>
        {layerOpen && (
          <div className="absolute left-0 top-2 z-[1000] bg-elevated-95 backdrop-blur border border-edge rounded-lg p-2.5 min-w-[160px] shadow-2xl">
            <div className="flex items-center justify-between mb-1.5 px-1">
              <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">
                {locale === 'zh' ? '图层控制' : 'Layers'}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-dim">{activeLayers.length}/{LAYER_OPTIONS.length}</span>
                <button onClick={() => setLayerOpen(false)} className="text-[9px] text-muted hover:text-ink-2" title={locale === 'zh' ? '收起' : 'Collapse'}>×</button>
              </div>
            </div>
            <div className="space-y-0.5">
              {LAYER_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 py-1 px-1 rounded hover:bg-overlay cursor-pointer text-[10px] text-ink-2"
                >
                  <input
                    type="checkbox"
                    checked={isLayerActive(opt.key)}
                    onChange={() => toggleLayer(opt.key)}
                    className="w-2.5 h-2.5 rounded accent-[var(--accent)]"
                  />
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: opt.color }} />
                  {locale === 'zh' ? opt.label.zh : opt.label.en}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-edge px-1">
              <button onClick={selectAllLayers} className="text-[9px] text-accent hover:text-accent-dim">
                {locale === 'zh' ? '全选' : 'All'}
              </button>
              <span className="w-px h-2.5 bg-edge" />
              <button onClick={clearLayers} className="text-[9px] text-muted hover:text-ink-2">
                {locale === 'zh' ? '清空' : 'None'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-t border-edge text-[9px] text-muted flex-wrap">
        {isLayerActive('lab') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#38bdf8]" />{locale === 'zh' ? '大模型厂商' : 'Model Lab'}</span>}
        {isLayerActive('agent-project') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#34d399]" />{locale === 'zh' ? 'Agent 开源' : 'Agent OSS'}</span>}
        {isLayerActive('agent-platform') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fb923c]" />{locale === 'zh' ? 'Agent 平台' : 'Agent Platform'}</span>}
        {isLayerActive('infra') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#94a3b8]" />{locale === 'zh' ? '基础设施' : 'Infra'}</span>}
        {isLayerActive('company') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#06b6d4]" />{locale === 'zh' ? '公司' : 'Company'}</span>}
        {isLayerActive('chip') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#06b6d4]" style={{ opacity: 0.6 }} />{locale === 'zh' ? '芯片/硬件' : 'Chip/Hardware'}</span>}
        {isLayerActive('research') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#a78bfa]" />{locale === 'zh' ? '研究机构' : 'Research'}</span>}
        {isLayerActive('signal') && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f59e0b]" />{locale === 'zh' ? '信号' : 'Signal'}</span>}
        {isLayerActive('connection') && <><span className="flex items-center gap-1"><span className="w-1.5 h-0 rounded-sm border-t border-dashed border-[#06b6d4]/60 w-4" />MCP</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-0 rounded-sm border-t border-dashed border-[#34d399]/60 w-4" />RAG</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-0 rounded-sm border-t border-dashed border-[#a78bfa]/60 w-4" />Memory</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-0 rounded-sm border-t border-dashed border-[#f59e0b]/60 w-4" />Eval</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-0 rounded-sm border-t border-dashed border-[#fb7185]/60 w-4" />Deploy</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-0 rounded-sm border-t border-dashed border-[#ef4444]/60 w-4" />{locale === 'zh' ? '竞争' : 'Compete'}</span></>}
        <span className="ml-auto">{filteredHubs.length} {locale === 'zh' ? '个可见据点' : 'visible hubs'}{showConnections ? ` · ${ALL_CONNECTIONS.length} ${locale === 'zh' ? '条连线' : 'connections'}` : ''}</span>
      </div>
    </PanelBase>
  )
})

export default DashboardMap
