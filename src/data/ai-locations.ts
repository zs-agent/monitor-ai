export interface AiModel {
  name: string
  version: string
  releaseYear: string
  description?: string
}

export interface AiLocation {
  id: string
  name: string
  nameZh: string
  lat: number
  lng: number
  type: 'company' | 'research' | 'datacenter' | 'conference' | 'chip' | 'lab' | 'agent-project' | 'agent-platform' | 'infra'
  country: string
  city: string
  cityZh: string
  importance: number
  models: AiModel[]
  description?: string
  /** 生态节点附加信息（全景 AI Agent 生态地图用） */
  ecosystem?: {
    /** 子类型：orchestration | multi-agent | mcp | rag | memory | eval | observability | deploy | inference | platform */
    subtype: string
    /** GitHub owner/repo，如 'langchain-ai/langgraph' */
    github?: string
    /** 官网 */
    home?: string
    /** 关联技术关键词（用于联动信号/论文匹配） */
    techRelations?: string[]
    /** 位置为示意（维护者所在区域） */
    note?: string
  }
}

export const AI_HUBS: AiLocation[] = [
  {
    id: 'openai', name: 'OpenAI', nameZh: 'OpenAI', lat: 37.7749, lng: -122.4194, type: 'company', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5,
    description: '全球AI产业领导者，推出GPT系列与Sora',
    models: [
      { name: 'GPT-5.6 Sol', version: 'max/xhigh/high/medium/low', releaseYear: '2026-07', description: '旗舰推理模型，Artificial Analysis排名第4' },
      { name: 'GPT-5.6 Terra', version: 'max/xhigh/high/medium/low', releaseYear: '2026-07', description: '低成本高效模型' },
      { name: 'GPT-5.6 Luna', version: 'max/xhigh/high/medium/low', releaseYear: '2026-07', description: '轻量级模型' },
      { name: 'GPT-5.3 Codex', version: 'xhigh/high', releaseYear: '2026-05', description: '代码专用模型' },
      { name: 'gpt-oss-120b', version: 'high/low', releaseYear: '2025-12', description: '开源轻量模型' },
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic', nameZh: 'Anthropic', lat: 37.7935, lng: -122.3929, type: 'company', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5,
    description: '以AI安全为核心的Claude系列模型',
    models: [
      { name: 'Claude Opus 5', version: 'max/xhigh/high/medium/low', releaseYear: '2026-06', description: 'Atlas Intelligence Index排名#1，推理能力最强大模型' },
      { name: 'Claude Opus 4.8', version: 'max/high', releaseYear: '2026-03', description: '前代旗舰' },
      { name: 'Claude Sonnet 5', version: 'max/xhigh/high/medium/low', releaseYear: '2026-06', description: '高性能性价比模型' },
      { name: 'Claude Fable 5', version: 'max (fallback)', releaseYear: '2026-06', description: '增强推理版本' },
      { name: 'Claude Sonnet 4.6', version: 'Non-reasoning Low Effort', releaseYear: '2026-05', description: '轻量推理版本' },
    ],
  },
  {
    id: 'google-dm', name: 'Google DeepMind', nameZh: '谷歌DeepMind', lat: 37.4221, lng: -122.0841, type: 'company', country: 'US', city: 'Mountain View', cityZh: '山景城', importance: 5,
    description: '推出Gemini系列多模态模型',
    models: [
      { name: 'Gemini 3.6 Flash', version: 'latest', releaseYear: '2026-07', description: '最新快速推理模型' },
      { name: 'Gemini 3.5 Flash', version: 'latest', releaseYear: '2026-05', description: '高性价比高速模型' },
      { name: 'Gemini 3.1 Pro Preview', version: 'preview', releaseYear: '2026-04', description: '专业预览版' },
      { name: 'Gemma 4 31B', version: 'latest', releaseYear: '2026-04', description: '开源大模型' },
      { name: 'Gemma 4 26B A4B', version: 'latest', releaseYear: '2026-04', description: 'MoE开源模型' },
    ],
  },
  {
    id: 'meta-ai', name: 'Meta AI (FAIR)', nameZh: 'Meta AI', lat: 37.4848, lng: -122.1482, type: 'research', country: 'US', city: 'Menlo Park', cityZh: '门洛帕克', importance: 4,
    description: '开源AI领军者，Llama系列发布者',
    models: [
      { name: 'Llama 4 Scout', version: 'latest', releaseYear: '2026-05', description: '开源大模型，超大上下文窗口' },
      { name: 'Muse Spark 1.1', version: 'xhigh', releaseYear: '2026-06', description: '新AI引擎' },
      { name: 'Llama 4 Maverick', version: 'latest', releaseYear: '2025-08', description: '高性能版本' },
      { name: 'Llama 3.3 70B', version: 'latest', releaseYear: '2025-03', description: '成熟稳定版本' },
    ],
  },
  {
    id: 'xai', name: 'xAI', nameZh: 'xAI', lat: 37.779, lng: -122.417, type: 'company', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 4,
    description: 'Elon Musk创立的AI公司，开发Grok系列',
    models: [
      { name: 'Grok 4.5', version: 'high', releaseYear: '2026-06', description: '旗舰模型' },
      { name: 'Grok 4.3', version: 'medium/low', releaseYear: '2026-05', description: '优化推理版本' },
    ],
  },
  {
    id: 'microsoft-ai', name: 'Microsoft AI', nameZh: '微软AI', lat: 47.6409, lng: -122.1292, type: 'research', country: 'US', city: 'Redmond', cityZh: '雷德蒙德', importance: 4,
    description: 'Azure AI平台 + Copilot生态系统',
    models: [
      { name: 'Copilot AI', version: 'latest', releaseYear: '2026-05', description: 'AI助手平台' },
      { name: 'Phi-4/Mini', version: 'latest', releaseYear: '2025-12', description: '小型本地模型' },
    ],
  },
  {
    id: 'nvidia', name: 'NVIDIA', nameZh: '英伟达', lat: 37.3709, lng: -121.9688, type: 'company', country: 'US', city: 'Santa Clara', cityZh: '圣克拉拉', importance: 5,
    description: 'AI芯片霸主，GPU霸主，提供H100/B200与Nemotron模型系列',
    models: [
      { name: 'Nemotron 3 Ultra', version: 'latest', releaseYear: '2026-04', description: '旗舰大模型' },
      { name: 'Nemotron 3 Super', version: 'latest', releaseYear: '2026-06', description: '高性能版本' },
      { name: 'Nemotron 3 Nano', version: 'latest', releaseYear: '2026-03', description: '轻量级模型' },
      { name: 'NVLM Nemotron', version: 'various', releaseYear: '2025-12', description: '多模态系列' },
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', nameZh: '深度求索', lat: 30.2741, lng: 120.1551, type: 'company', country: 'CN', city: 'Hangzhou', cityZh: '杭州', importance: 5,
    description: '中国AI领域领军企业，以开源MoE架构闻名全球',
    models: [
      { name: 'DeepSeek V4 Pro', version: 'max/high', releaseYear: '2026-06', description: '旗舰推理模型' },
      { name: 'DeepSeek V4 Flash', version: 'max/high', releaseYear: '2026-07', description: '快速推理版本' },
      { name: 'DeepSeek R1', version: 'latest', releaseYear: '2025-01', description: '开创推理模型先河' },
    ],
  },
  {
    id: 'zhipu', name: 'Zhipu AI', nameZh: '智谱AI', lat: 39.9042, lng: 116.4074, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4,
    description: 'GLM系列模型，中国AI独角兽',
    models: [
      { name: 'GLM-5.2', version: 'max', releaseYear: '2026-06', description: '新一代开源旗舰模型，排名最高开源模型' },
      { name: 'GLM-5.2', version: 'base', releaseYear: '2026-06', description: '基础版本' },
    ],
  },
  {
    id: 'moonshot', name: 'Moonshot AI', nameZh: '月之暗面', lat: 39.958, lng: 116.452, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 5,
    description: 'Kimi系列模型，中国AI新锐力量',
    models: [
      { name: 'Kimi K3', version: 'latest', releaseYear: '2026-07', description: '新一代旗舰，排名中国第一' },
      { name: 'Kimi K2.7 Code', version: 'latest', releaseYear: '2026-06', description: '代码优化版本' },
      { name: 'Kimi K2.6', version: 'latest', releaseYear: '2026-05', description: '前代推理模型' },
      { name: 'Kimi Linear 48B A3B', version: 'Instruct', releaseYear: '2026-06', description: 'MoE轻量推理版本' },
    ],
  },
  {
    id: 'minimax', name: 'MiniMax', nameZh: 'MiniMax', lat: 31.2304, lng: 121.4737, type: 'company', country: 'CN', city: 'Shanghai', cityZh: '上海', importance: 4,
    description: 'MiniMax-M系列，开源大语言模型',
    models: [
      { name: 'MiniMax-M3', version: 'latest', releaseYear: '2026-06', description: '旗舰模型，表现出色' },
    ],
  },
  {
    id: 'baichuan', name: 'Baichuan AI', nameZh: '百川智能', lat: 39.909, lng: 116.412, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 3,
    description: '中国大模型创企，百川系列',
    models: [
      { name: 'Baichuan-M2', version: 'latest', releaseYear: '2025-05', description: '旗舰版本' },
    ],
  },
  {
    id: 'stepfun', name: 'StepFun', nameZh: '阶跃星辰', lat: 31.233, lng: 121.482, type: 'company', country: 'CN', city: 'Shanghai', cityZh: '上海', importance: 3,
    description: 'Step系列多模态模型',
    models: [
      { name: 'Step 3.7 Flash', version: 'latest', releaseYear: '2026-05', description: '快速推理版本' },
    ],
  },
  {
    id: 'baidu', name: 'Baidu AI', nameZh: '百度AI', lat: 40.016, lng: 116.305, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4,
    description: '文心一言/ERNIE系列模型',
    models: [
      { name: 'ERNIE 5.0 Thinking', version: 'Preview', releaseYear: '2026-06', description: '新一代推理模型' },
      { name: 'ERNIE 4.5 300B', version: 'latest', releaseYear: '2025-12', description: 'MoE大语言模型' },
    ],
  },
  {
    id: 'alibaba-damo', name: 'Alibaba Qwen', nameZh: '阿里通义千问', lat: 30.251, lng: 120.138, type: 'research', country: 'CN', city: 'Hangzhou', cityZh: '杭州', importance: 4,
    description: 'Qwen系列开源大模型，国内模型品类最全',
    models: [
      { name: 'Qwen3.7 Max', version: 'latest', releaseYear: '2026-07', description: '最新旗舰模型' },
      { name: 'Qwen3.7 Plus', version: 'latest', releaseYear: '2026-07', description: '增强版本' },
      { name: 'Qwen3.6 Plus', version: 'latest', releaseYear: '2026-05', description: '高性能版本' },
      { name: 'Qwen3.6 27B', version: 'latest', releaseYear: '2026-04', description: '中型模型' },
      { name: 'Qwen3 Coder Next', version: 'latest', releaseYear: '2026-06', description: '代码专用版本' },
    ],
  },
  {
    id: 'bytedance', name: 'ByteDance Seed', nameZh: '字节跳动Seed', lat: 39.956, lng: 116.330, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 3,
    description: '豆包/Seed系列大模型',
    models: [
      { name: 'Doubao Seed Code', version: 'latest', releaseYear: '2026-06', description: '代码模型' },
    ],
  },
  {
    id: 'tencent', name: 'Tencent AI', nameZh: '腾讯混元', lat: 22.5431, lng: 114.0579, type: 'company', country: 'CN', city: 'Shenzhen', cityZh: '深圳', importance: 4,
    description: 'Hunyuan/混元系列大模型',
    models: [
      { name: 'Hy3', version: 'preview', releaseYear: '2026-06', description: '最新旗舰模型' },
      { name: 'Hunyuan-TurboS', version: 'latest', releaseYear: '2025-05', description: '高速推理版本' },
    ],
  },
  {
    id: 'xiaomi', name: 'Xiaomi AI', nameZh: '小米AI', lat: 39.984, lng: 116.317, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 3,
    description: 'MiMo系列模型',
    models: [
      { name: 'MiMo-V2.5-Pro', version: 'latest', releaseYear: '2026-05', description: '旗舰版本' },
      { name: 'MiMo-V2.5', version: 'latest', releaseYear: '2026-03', description: '高性价比版本' },
    ],
  },
  {
    id: 'tsinghua-air', name: 'Tsinghua AIR', nameZh: '清华AIR', lat: 40.002, lng: 116.329, type: 'research', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 3,
    description: '清华大学人工智能研究院',
    models: [],
  },
  {
    id: 'sense-time', name: 'SenseTime', nameZh: '商汤科技', lat: 22.5431, lng: 114.0579, type: 'company', country: 'CN', city: 'Shenzhen', cityZh: '深圳', importance: 3,
    description: 'CV与大模型平台',
    models: [],
  },
  {
    id: 'kuaishou', name: 'Kuaishou Kling', nameZh: '快手可灵', lat: 39.983, lng: 116.305, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 2,
    description: 'AI视频生成Kling/可灵',
    models: [],
  },
  {
    id: '01ai', name: '01.AI', nameZh: '零一万物', lat: 39.981, lng: 116.313, type: 'company', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 2,
    description: '李开复创立，Yi系列模型',
    models: [],
  },
  {
    id: 'mistral', name: 'Mistral AI', nameZh: 'Mistral AI', lat: 48.8566, lng: 2.3522, type: 'company', country: 'FR', city: 'Paris', cityZh: '巴黎', importance: 4,
    description: '欧洲AI旗舰，开源模型领导者',
    models: [
      { name: 'Mistral Large 3', version: 'latest', releaseYear: '2026-03', description: '旗舰模型' },
      { name: 'Ministral 3 14B', version: 'latest', releaseYear: '2026-05', description: '中型模型' },
      { name: 'Codestral', version: 'latest', releaseYear: '2025-09', description: '代码模型' },
    ],
  },
  {
    id: 'huggingface', name: 'Hugging Face', nameZh: 'Hugging Face', lat: 48.8588, lng: 2.350, type: 'company', country: 'FR', city: 'Paris', cityZh: '巴黎', importance: 3,
    description: '全球最大AI开源模型社区与平台',
    models: [],
  },
  {
    id: 'stability', name: 'Stability AI', nameZh: 'Stability AI', lat: 51.5074, lng: -0.1278, type: 'company', country: 'UK', city: 'London', cityZh: '伦敦', importance: 3,
    description: 'Stable Diffusion文生图开源模型',
    models: [
      { name: 'Stable Diffusion 4', version: 'latest', releaseYear: '2026-04', description: '新一代文生图' },
    ],
  },
  {
    id: 'cohere', name: 'Cohere', nameZh: 'Cohere', lat: 43.6532, lng: -79.3832, type: 'company', country: 'CA', city: 'Toronto', cityZh: '多伦多', importance: 3,
    description: '企业级大模型与RAG平台',
    models: [
      { name: 'Command A+', version: 'latest', releaseYear: '2026-03', description: '旗舰企业模型' },
    ],
  },

  // ===== Chip / Hardware Vendors =====
  {
    id: 'amd', name: 'AMD', nameZh: 'AMD', lat: 37.3670, lng: -121.9680, type: 'chip', country: 'US', city: 'Santa Clara', cityZh: '圣克拉拉', importance: 4,
    description: 'GPU与CPU芯片巨头，AI加速器MI系列挑战NVIDIA',
    models: [
      { name: 'MI400', version: 'latest', releaseYear: '2026-06', description: 'AI加速旗舰GPU' },
      { name: 'MI350X', version: 'latest', releaseYear: '2025-12', description: 'AI训练推理芯片' },
      { name: 'Ryzen AI 300', version: 'series', releaseYear: '2025-10', description: 'AI PC处理器' },
    ],
  },
  {
    id: 'intel', name: 'Intel', nameZh: '英特尔', lat: 37.3870, lng: -121.9630, type: 'chip', country: 'US', city: 'Santa Clara', cityZh: '圣克拉拉', importance: 5,
    description: '全球最大半导体制造商，Gaudi AI加速器与Xeon处理器',
    models: [
      { name: 'Gaudi 4', version: 'latest', releaseYear: '2026-05', description: 'AI训练加速器' },
      { name: 'Xeon 6', version: 'series', releaseYear: '2025-11', description: '数据中心CPU' },
      { name: 'Lunar Lake', version: 'series', releaseYear: '2025-09', description: 'AI PC处理器' },
    ],
  },
  {
    id: 'qualcomm', name: 'Qualcomm', nameZh: '高通', lat: 32.8960, lng: -117.1930, type: 'chip', country: 'US', city: 'San Diego', cityZh: '圣地亚哥', importance: 4,
    description: '移动芯片霸主，AI Engine与骁龙平台领导者',
    models: [
      { name: 'Snapdragon X Elite 2', version: 'latest', releaseYear: '2026-06', description: 'AI PC旗舰芯片' },
      { name: 'Snapdragon 8 Gen 5', version: 'latest', releaseYear: '2026-03', description: '移动端AI芯片' },
      { name: 'Cloud AI 200', version: 'latest', releaseYear: '2025-11', description: '云端AI推理芯片' },
    ],
  },
  {
    id: 'broadcom', name: 'Broadcom', nameZh: '博通', lat: 37.3220, lng: -121.8980, type: 'chip', country: 'US', city: 'San Jose', cityZh: '圣何塞', importance: 3,
    description: 'AI网络芯片与定制ASIC加速器',
    models: [
      { name: 'Jericho3-AI', version: 'latest', releaseYear: '2025-08', description: 'AI网络交换芯片' },
      { name: 'TPU v6 ASIC', version: 'custom', releaseYear: '2026-04', description: 'Google定制AI芯片' },
    ],
  },
  {
    id: 'micron', name: 'Micron', nameZh: '美光', lat: 43.6030, lng: -116.2190, type: 'chip', country: 'US', city: 'Boise', cityZh: '博伊西', importance: 3,
    description: '全球存储芯片巨头，HBM高带宽内存领导者',
    models: [
      { name: 'HBM4', version: 'latest', releaseYear: '2026-05', description: '下一代高带宽内存' },
      { name: 'GDDR7', version: 'latest', releaseYear: '2025-12', description: 'AI图形显存' },
      { name: '9550 NVMe SSD', version: 'latest', releaseYear: '2025-09', description: 'AI存储解决方案' },
    ],
  },
  {
    id: 'tsmc', name: 'TSMC', nameZh: '台积电', lat: 24.8080, lng: 120.9960, type: 'chip', country: 'TW', city: 'Hsinchu', cityZh: '新竹', importance: 5,
    description: '全球最大晶圆代工厂，3nm/2nm制程领导者',
    models: [
      { name: 'N2 (2nm)', version: 'process', releaseYear: '2026-06', description: '下一代先进制程' },
      { name: 'N3E (3nm)', version: 'process', releaseYear: '2025-06', description: '3nm增强版' },
      { name: 'CoWoS-L', version: 'packaging', releaseYear: '2025-09', description: '先进封装方案' },
    ],
  },
  {
    id: 'samsung', name: 'Samsung', nameZh: '三星', lat: 37.2630, lng: 127.0280, type: 'chip', country: 'KR', city: 'Suwon', cityZh: '水原', importance: 4,
    description: '全球半导体巨头，存储+代工+AI芯片全栈',
    models: [
      { name: 'HBM4', version: 'latest', releaseYear: '2026-06', description: '高带宽内存' },
      { name: 'Exynos AI', version: 'latest', releaseYear: '2026-03', description: 'AI移动处理器' },
      { name: 'SF3 (3nm GAA)', version: 'process', releaseYear: '2025-12', description: '3nm环绕栅极工艺' },
    ],
  },
  {
    id: 'sk-hynix', name: 'SK Hynix', nameZh: 'SK海力士', lat: 37.2720, lng: 127.4420, type: 'chip', country: 'KR', city: 'Icheon', cityZh: '利川', importance: 4,
    description: 'HBM高带宽内存领导者，NVIDIA核心供应商',
    models: [
      { name: 'HBM4', version: 'latest', releaseYear: '2026-04', description: '下一代HBM' },
      { name: 'HBM3E', version: 'latest', releaseYear: '2025-06', description: '当前旗舰HBM' },
      { name: 'CXL Memory', version: 'latest', releaseYear: '2025-10', description: 'CXL内存扩展' },
    ],
  },
  {
    id: 'asml', name: 'ASML', nameZh: 'ASML', lat: 51.4090, lng: 5.3960, type: 'chip', country: 'NL', city: 'Veldhoven', cityZh: '维尔德霍芬', importance: 4,
    description: '全球唯一EUV光刻机供应商，芯片制造核心设备商',
    models: [
      { name: 'NXE:3800E', version: 'latest', releaseYear: '2026-03', description: 'High-NA EUV光刻机' },
      { name: 'TWINSCAN NXT', version: 'series', releaseYear: '2025-08', description: 'DUV光刻系统' },
    ],
  },
  {
    id: 'cambricon', name: 'Cambricon', nameZh: '寒武纪', lat: 39.9850, lng: 116.3200, type: 'chip', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 3,
    description: '中国AI芯片独角兽，思元系列智能加速卡',
    models: [
      { name: 'Siyuan MLU590', version: 'latest', releaseYear: '2026-04', description: '旗舰AI训练芯片' },
      { name: 'Siyuan MLU370', version: 'latest', releaseYear: '2025-06', description: 'AI推理加速卡' },
    ],
  },
  {
    id: 'hygon', name: 'Hygon', nameZh: '海光信息', lat: 39.9890, lng: 116.3150, type: 'chip', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 3,
    description: '国产x86 CPU与AI加速芯片，深算系列',
    models: [
      { name: 'Shensuan DCU', version: 'latest', releaseYear: '2026-05', description: 'AI加速协处理器' },
      { name: 'Hygon 7000', version: 'series', releaseYear: '2025-10', description: '国产x86服务器CPU' },
    ],
  },
  {
    id: 'hisilicon', name: 'HiSilicon', nameZh: '华为海思', lat: 22.5500, lng: 114.0600, type: 'chip', country: 'CN', city: 'Shenzhen', cityZh: '深圳', importance: 5,
    description: '华为旗下芯片设计公司，昇腾AI芯片与麒麟处理器',
    models: [
      { name: 'Ascend 910C', version: 'latest', releaseYear: '2026-06', description: '旗舰AI训练芯片' },
      { name: 'Ascend 310P', version: 'latest', releaseYear: '2025-12', description: 'AI推理芯片' },
      { name: 'Kirin 9100', version: 'latest', releaseYear: '2025-10', description: '移动AI处理器' },
    ],
  },
  {
    id: 'smic', name: 'SMIC', nameZh: '中芯国际', lat: 31.2400, lng: 121.6250, type: 'chip', country: 'CN', city: 'Shanghai', cityZh: '上海', importance: 4,
    description: '中国大陆最大晶圆代工厂，N+2先进制程',
    models: [
      { name: 'N+2', version: 'process', releaseYear: '2026-03', description: '先进制程工艺' },
      { name: '28nm HV', version: 'process', releaseYear: '2025-06', description: '成熟制程' },
    ],
  },
  {
    id: 'cxmt', name: 'CXMT', nameZh: '长鑫存储', lat: 31.8600, lng: 117.2800, type: 'chip', country: 'CN', city: 'Hefei', cityZh: '合肥', importance: 3,
    description: '国产DRAM内存芯片领导者，LPDDR5量产',
    models: [
      { name: 'LPDDR5', version: 'latest', releaseYear: '2026-04', description: '移动内存芯片' },
      { name: 'DDR5', version: 'latest', releaseYear: '2025-09', description: '桌面内存芯片' },
    ],
  },
  {
    id: 'ymtc', name: 'YMTC', nameZh: '长江存储', lat: 30.5200, lng: 114.4200, type: 'chip', country: 'CN', city: 'Wuhan', cityZh: '武汉', importance: 3,
    description: '国产3D NAND闪存芯片领导者，Xtacking架构',
    models: [
      { name: 'Xtacking 4.0', version: 'latest', releaseYear: '2026-05', description: '232层3D NAND' },
      { name: 'TiPlus 7100', version: 'latest', releaseYear: '2025-08', description: '消费级SSD' },
    ],
  },
]
