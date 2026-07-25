export interface AIStock {
  symbol: string
  name: string
  nameZh: string
  price: number
  change: number
  changePct: number
  market: 'US' | 'CN' | 'OTHER'
  sector: 'chip' | 'cloud' | 'model' | 'infra' | 'hardware'
}

export interface AIEventImpact {
  id: string
  title: string
  titleZh: string
  summary: string
  summaryZh: string
  date: string
  impact: 'positive' | 'negative' | 'neutral'
  affectedStocks: string[]
  imageUrl?: string
  videoUrl?: string
  source: string
}

export interface AIInfra {
  id: string
  name: string
  nameZh: string
  location: string
  locationZh: string
  type: 'datacenter' | 'supercomputer' | 'cluster'
  operator: string
  gpuCount: number
  powerMW: number
  status: 'operational' | 'building' | 'planned'
}

export const AI_STOCKS: AIStock[] = [
  { symbol: 'NVDA', name: 'NVIDIA', nameZh: '英伟达', price: 142.35, change: 3.21, changePct: 2.31, market: 'US', sector: 'chip' },
  { symbol: 'AMD', name: 'AMD', nameZh: '超威半导体', price: 168.72, change: -1.45, changePct: -0.85, market: 'US', sector: 'chip' },
  { symbol: 'TSM', name: 'TSMC', nameZh: '台积电', price: 198.50, change: 2.80, changePct: 1.43, market: 'OTHER', sector: 'chip' },
  { symbol: 'AVGO', name: 'Broadcom', nameZh: '博通', price: 215.30, change: 4.15, changePct: 1.96, market: 'US', sector: 'chip' },
  { symbol: 'MSFT', name: 'Microsoft', nameZh: '微软', price: 468.90, change: 2.10, changePct: 0.45, market: 'US', sector: 'cloud' },
  { symbol: 'GOOGL', name: 'Alphabet', nameZh: '谷歌', price: 198.40, change: 1.85, changePct: 0.94, market: 'US', sector: 'cloud' },
  { symbol: 'AMZN', name: 'Amazon', nameZh: '亚马逊', price: 234.20, change: -0.60, changePct: -0.26, market: 'US', sector: 'cloud' },
  { symbol: 'META', name: 'Meta', nameZh: 'Meta', price: 567.80, change: 5.30, changePct: 0.94, market: 'US', sector: 'model' },
  { symbol: 'ANET', name: 'Arista', nameZh: 'Arista', price: 395.60, change: 8.40, changePct: 2.17, market: 'US', sector: 'infra' },
  { symbol: 'MRVL', name: 'Marvell', nameZh: '美满电子', price: 82.45, change: 1.20, changePct: 1.48, market: 'US', sector: 'chip' },
  { symbol: '寒武纪', name: 'Cambricon', nameZh: '寒武纪', price: 285.60, change: 8.90, changePct: 3.22, market: 'CN', sector: 'chip' },
  { symbol: '中芯国际', name: 'SMIC', nameZh: '中芯国际', price: 68.30, change: 1.25, changePct: 1.86, market: 'CN', sector: 'chip' },
  { symbol: '浪潮信息', name: 'Inspur', nameZh: '浪潮信息', price: 52.80, change: 0.95, changePct: 1.83, market: 'CN', sector: 'infra' },
  { symbol: '中际旭创', name: 'Zhongji Innolight', nameZh: '中际旭创', price: 178.20, change: 5.60, changePct: 3.24, market: 'CN', sector: 'infra' },
]

export const AI_EVENT_IMPACTS: AIEventImpact[] = [
  {
    id: 'e1',
    title: 'Anthropic Releases Claude Opus 5 — Intelligence Breakthrough',
    titleZh: 'Anthropic 发布 Claude Opus 5 — 智能突破',
    summary: 'Claude Opus 5 approaches Claude Fable 5 intelligence at half the price. Frontier-Bench scores more than double. Analysts expect this to pressure OpenAI and accelerate enterprise adoption.',
    summaryZh: 'Claude Opus 5 以一半价格达到接近 Claude Fable 5 的智能水平，Frontier-Bench 分数翻倍以上。分析师预计将给 OpenAI 带来压力并加速企业采用。',
    date: '2026-07-25',
    impact: 'positive',
    affectedStocks: ['MSFT', 'GOOGL', 'AMZN'],
    source: 'Anthropic Newsroom',
  },
  {
    id: 'e2',
    title: 'US Tightens Chip Export Controls — New AI Chip Restrictions',
    titleZh: '美国收紧芯片出口管制 — 新增 AI 芯片限制',
    summary: 'Biden administration announces new restrictions on AI chip exports to China, covering HBM memory and advanced packaging. SMIC and Cambricon shares dropped initially but rebounded on domestic substitution hopes.',
    summaryZh: '拜登政府宣布对华 AI 芯片出口新限制，涵盖 HBM 内存和先进封装。中芯国际和寒武纪股价先跌后涨，国产替代预期升温。',
    date: '2026-07-24',
    impact: 'negative',
    affectedStocks: ['NVDA', 'AMD', 'TSM', '寒武纪', '中芯国际'],
    source: 'Reuters',
  },
  {
    id: 'e3',
    title: 'Beijing Issues First-Ever AI Agent Policy — Token Economy',
    titleZh: '北京发布首个智能体政策 — Token 经济写入文件',
    summary: '10-point policy introduces Harness Engineering, Token Economy, OPC into formal regulation. Pushes TaaS/AaaS model. Chinese AI stocks surge on policy tailwinds.',
    summaryZh: '十条措施首次将 Harness Engineering、Token 经济等写入正式政策，推动 TaaS/AaaS 模式。国内 AI 概念股集体上涨。',
    date: '2026-07-24',
    impact: 'positive',
    affectedStocks: ['寒武纪', '浪潮信息', '中际旭创'],
    source: '数字生命卡兹克',
  },
  {
    id: 'e4',
    title: 'OpenAI GPT-5.6 Sol Benchmarks Leak — Major Performance Gains',
    titleZh: 'OpenAI GPT-5.6 Sol 基准测试泄露 — 性能大幅提升',
    summary: 'Leaked benchmark scores show GPT-5.6 Sol achieving 59 Arena score, closing gap with Claude Opus 5. Microsoft Azure pre-orders reportedly surge 40% in anticipation.',
    summaryZh: '泄露的基准测试显示 GPT-5.6 Sol 达到 59 Arena 分数，缩小与 Claude Opus 5 的差距。微软 Azure 预定量预计增长 40%。',
    date: '2026-07-23',
    impact: 'positive',
    affectedStocks: ['MSFT', 'NVDA'],
    source: 'The Verge',
  },
  {
    id: 'e5',
    title: 'TSMC Arizona Fab Begins 3nm Production — AI Chip Supply Boost',
    titleZh: '台积电亚利桑那工厂开始 3nm 生产 — 提升 AI 芯片供应',
    summary: 'TSMC\'s Arizona fab begins volume production of 3nm chips, easing supply constraints for NVIDIA and AMD. Stock rises on diversification narrative.',
    summaryZh: '台积电亚利桑那工厂开始量产 3nm 芯片，缓解英伟达和 AMD 的供应压力。股价因多元化布局上涨。',
    date: '2026-07-22',
    impact: 'positive',
    affectedStocks: ['TSM', 'NVDA', 'AMD'],
    source: 'Financial Times',
  },
  {
    id: 'e6',
    title: 'DeepSeek V4 Pro Claims 90% of GPT-5 Performance at 20% Cost',
    titleZh: 'DeepSeek V4 Pro 声称以 20% 成本达到 GPT-5 90% 性能',
    summary: 'Chinese AI lab DeepSeek releases V4 Pro, claiming near-parity with US frontier models at fraction of inference cost. Triggers price war in Chinese AI API market.',
    summaryZh: '中国 AI 实验室 DeepSeek 发布 V4 Pro，声称以极低推理成本达到美国前沿模型水平，引发国内 AI API 价格战。',
    date: '2026-07-21',
    impact: 'neutral',
    affectedStocks: ['寒武纪', '浪潮信息'],
    source: 'TechCrunch',
  },
]

export const AI_INFRA: AIInfra[] = [
  { id: 'i1', name: 'Microsoft AI Supercomputer', nameZh: '微软 AI 超算', location: 'Des Moines, Iowa, US', locationZh: '爱荷华州, 美国', type: 'supercomputer', operator: 'Microsoft', gpuCount: 500000, powerMW: 600, status: 'operational' },
  { id: 'i2', name: 'Meta AI Research Cluster', nameZh: 'Meta AI 研究集群', location: 'Santa Clara, CA, US', locationZh: '圣克拉拉, 美国', type: 'cluster', operator: 'Meta', gpuCount: 350000, powerMW: 400, status: 'operational' },
  { id: 'i3', name: 'Tencent Cloud AI Hub', nameZh: '腾讯云 AI 中心', location: 'Guangdong, China', locationZh: '广东, 中国', type: 'datacenter', operator: 'Tencent', gpuCount: 200000, powerMW: 250, status: 'operational' },
  { id: 'i4', name: 'Alibaba AI Compute Zone', nameZh: '阿里 AI 计算区', location: 'Zhangbei, Hebei, China', locationZh: '张北, 河北', type: 'datacenter', operator: 'Alibaba Cloud', gpuCount: 180000, powerMW: 220, status: 'building' },
  { id: 'i5', name: 'Google TPU v7 Pod', nameZh: 'Google TPU v7 集群', location: 'Mayes County, OK, US', locationZh: '梅斯县, 美国', type: 'cluster', operator: 'Google', gpuCount: 600000, powerMW: 700, status: 'building' },
  { id: 'i6', name: 'ByteDance AI Campus', nameZh: '字节跳动 AI 园区', location: 'Beijing, China', locationZh: '北京, 中国', type: 'datacenter', operator: 'ByteDance', gpuCount: 150000, powerMW: 180, status: 'planned' },
]