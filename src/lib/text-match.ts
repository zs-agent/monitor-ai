/**
 * 关键词 / 实体名匹配的统一口径。
 *
 * 起因：子串匹配会在面板上**伪造关联** —— `pro` 命中 improve/proposes（模型档案列出一堆无关论文），
 * `aws` 命中 laws、`apple` 命中 apples。规则：
 *   · 拉丁关键词要求词边界；中日韩关键词按子串（无词边界语义）
 *   · 短于 minLength 的 token 直接丢弃（`v4`/`9b`/`pro` 太泛）
 *   · 模型名切词后过一遍停用词表（large/language/intelligence… 这些不能当关联依据）
 *   · 实体名比对先归一化（去大小写、去标点、去尾缀「系列/技术报告」），再做完整名称比对（保留版本与变体差异）
 */

/** 静态字符串查表：词边界规则下不需要动态集合 */
export const STOPWORDS: Record<string, true> = {
  large: true, language: true, model: true, models: true, artificial: true, intelligence: true,
  agent: true, agents: true, based: true, with: true, from: true, into: true, using: true,
  study: true, paper: true, analysis: true, technical: true, report: true, series: true,
  version: true, research: true, system: true, systems: true, framework: true, '大模型': true,
  // 量化/格式类 token：会命中所有同格式的信号，不构成"这个模型"的关联依据
  gguf: true, ggml: true, awq: true, gptq: true, quant: true, quantized: true, safetensors: true,
  '模型': true, '技术': true, '报告': true, '系列': true, '智能': true, '系统': true, '研究': true,
}

/** 关键词正则：拉丁字母/数字开头 → 加左词边界，词尾若是字母数字再加右边界 */
export function keywordRegex(key: string): RegExp {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!/^[a-z0-9]/i.test(key)) return new RegExp(escaped, 'i')
  const trailing = /[a-z0-9_]$/i.test(key) ? '\\b' : ''
  return new RegExp(`\\b${escaped}${trailing}`, 'i')
}

/** 文本是否命中关键词（大小写不敏感；短词与停用词在此不做过滤，由调用方决定） */
export function matchesKeyword(text: string, key: string): boolean {
  return !!key.trim() && keywordRegex(key).test(text)
}

/** 命中哪些关键词（供下钻使用：拿真正命中的词去过滤，而不是展示名） */
export function matchedKeywords(text: string, keys: string[]): string[] {
  return keys.filter(key => matchesKeyword(text, key))
}

/** 从实体名切出可用于关联的 token：去标点、长度 ≥ minLength、过滤停用词 */
export function entityTokens(name: string, minLength = 4): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter(t => t.length >= minLength && !STOPWORDS[t])
}

/** 实体名归一化：去大小写与标点，去常见尾缀 */
export function normEntityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\u4e00-\u9fa5]+/g, '')
    .replace(/(系列|技术报告|开源模型|开源权重|technicalreport|series|report|model)$/g, '')
}

/** 两个名字是否指向同一实体（归一化后完整一致；禁止跨版本或跨变体借用评分） */
export function sameEntity(a: string, b: string): boolean {
  const na = normEntityName(a)
  const nb = normEntityName(b)
  if (!na || !nb) return false
  return na === nb
}

/** Full normalized model mention, preserving version and size; never match family token alone. */
export function mentionsEntity(text: string, name: string): boolean {
  const parts = name.toLowerCase().replace(/(系列|technical report|series)$/i, '').trim()
    .match(/[a-z]+|[0-9]+(?:\.[0-9]+)*|[\u4e00-\u9fff]+/g)
  if (!parts?.length) return false
  const escaped = parts.map(p => p.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[\\s_/-]*')
  return new RegExp('(?<![a-z0-9])' + escaped + '(?![a-z0-9]|\\.[0-9])', 'i').test(text)
}
