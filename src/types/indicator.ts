/** 指标元数据 */
export interface IndicatorMeta {
  /** World Bank 指标代码，如 'NY.GDP.MKTP.CD' */
  id: string
  /** 展示名称 */
  name: string
  /** 详细说明 */
  description: string
  /** 数据来源说明（World Bank API 返回的 sourceNote） */
  sourceNote: string
  /** 来源机构 */
  sourceOrganization: string
  /** 统计单位 */
  unit: string
  /** 主题标签 */
  topic: string[]
  /** 数据更新时间（API 返回的 lastUpdated） */
  lastUpdated: string
}

/** 单条指标数据点 */
export interface IndicatorValue {
  country: string       /* ISO 3166-1 alpha-3 */
  countryName: string   /* 国家全称 */
  year: number
  value: number | null  /* null = 缺失值 */
  indicator: string     /* indicator code */
}

/** 查询参数 */
export interface IndicatorQuery {
  indicator: string
  countries: string[]  /* ISO alpha-3 列表 */
  yearStart: number
  yearEnd: number
}

/** API 响应体 */
export interface IndicatorResponse {
  meta: IndicatorMeta | null
  values: IndicatorValue[]
  /** 各国家缺失年份情况 */
  missingInfo: { country: string; missingYears: number[] }[]
  /** 请求时间 */
  fetchedAt: string
  /** 缓存标记 */
  cached?: boolean
}

/** 预定义的宏观指标清单（首期 7 个：4 个 World Bank + 3 个 AI 原生） */
export const PRESET_INDICATORS: IndicatorMeta[] = [
  {
    id: 'AI.PAPERS',
    name: 'AI Papers Published',
    description: 'Number of AI-related research papers published per year, sourced from Semantic Scholar. Covers major AI conferences and arXiv.',
    sourceNote: 'Semantic Scholar academic database. Includes papers with AI/ML keywords.',
    sourceOrganization: 'Semantic Scholar',
    unit: 'papers per year',
    topic: ['AI Research', 'Science & Technology'],
    lastUpdated: '',
  },
  {
    id: 'AI.GITHUB',
    name: 'AI GitHub Projects Created',
    description: 'Number of new AI-related open-source repositories created per year on GitHub.',
    sourceNote: 'GitHub Search API. Includes repos with AI/ML topics and keywords.',
    sourceOrganization: 'GitHub',
    unit: 'repos per year',
    topic: ['Open Source', 'AI Development'],
    lastUpdated: '',
  },
  {
    id: 'AI.NEWS',
    name: 'AI News Coverage Intensity',
    description: 'Volume of AI-related news and discussions on Hacker News, indicating public interest and media attention.',
    sourceNote: 'Hacker News Firebase API. Counts stories matching AI keywords.',
    sourceOrganization: 'Hacker News',
    unit: 'stories per year',
    topic: ['AI Media', 'Public Interest'],
    lastUpdated: '',
  },
  {
    id: 'GB.XPD.RSDV.GD.ZS',
    name: 'Research and development expenditure (% of GDP)',
    description: 'Gross domestic expenditures on research and development (R&D), expressed as a percent of GDP. They include both capital and current expenditures in the four main sectors: Business enterprise, Government, Higher education, Private non-profit.',
    sourceNote: 'UNESCO Institute for Statistics (UIS).',
    sourceOrganization: 'UNESCO',
    unit: '% of GDP',
    topic: ['Science & Technology'],
    lastUpdated: '',
  },
  {
    id: 'SP.POP.SCIE.RD.P6',
    name: 'Researchers in R&D (per million people)',
    description: 'Researchers in R&D are professionals engaged in the conception or creation of new knowledge, products, processes, methods, or systems, as well as the management of these projects.',
    sourceNote: 'UNESCO Institute for Statistics (UIS).',
    sourceOrganization: 'UNESCO',
    unit: 'per million people',
    topic: ['Science & Technology'],
    lastUpdated: '',
  },
  {
    id: 'IT.NET.USER.ZS',
    name: 'Individuals using the Internet (% of population)',
    description: 'Internet users are individuals who have used the Internet (from any location) in the last 3 months.',
    sourceNote: 'International Telecommunication Union (ITU) World Telecommunication/ICT Indicators Database.',
    sourceOrganization: 'International Telecommunication Union',
    unit: '% of population',
    topic: ['Infrastructure'],
    lastUpdated: '',
  },
  {
    id: 'TX.VAL.TECH.MF.ZS',
    name: 'High-technology exports (% of manufactured exports)',
    description: 'High-technology exports are products with high R&D intensity, such as aerospace, computers, pharmaceuticals, scientific instruments, and electrical machinery.',
    sourceNote: 'United Nations, Comtrade database through the WITS platform.',
    sourceOrganization: 'United Nations',
    unit: '% of manufactured exports',
    topic: ['Trade', 'Science & Technology'],
    lastUpdated: '',
  },
]

/** 常用国家列表 */
export interface CountryOption {
  code: string  /* ISO alpha-3 */
  name: string
  nameZh: string
}

export const COMMON_COUNTRIES: CountryOption[] = [
  { code: 'USA', name: 'United States', nameZh: '美国' },
  { code: 'CHN', name: 'China', nameZh: '中国' },
  { code: 'JPN', name: 'Japan', nameZh: '日本' },
  { code: 'DEU', name: 'Germany', nameZh: '德国' },
  { code: 'GBR', name: 'United Kingdom', nameZh: '英国' },
  { code: 'KOR', name: 'South Korea', nameZh: '韩国' },
  { code: 'FRA', name: 'France', nameZh: '法国' },
  { code: 'IND', name: 'India', nameZh: '印度' },
  { code: 'CAN', name: 'Canada', nameZh: '加拿大' },
  { code: 'SGP', name: 'Singapore', nameZh: '新加坡' },
  { code: 'ISR', name: 'Israel', nameZh: '以色列' },
  { code: 'TWN', name: 'Taiwan', nameZh: '中国台湾' },
]
