/**
 * Agent 开源雷达 — 精选项目清单（人工梳理）
 * ---------------------------------------------------------------
 * stars / forks / 最近 release / 最近提交 / issue 活跃度等实时字段
 * 由 /api/agent-radar 从 GitHub API 获取后覆盖；
 * 此处仅维护 curated 静态字段（分类、关注原因、部署难度、企业风险等），
 * API 不可达时作为 static 兜底（实时字段显示为空态）。
 */

export type RadarCategory =
  | 'orchestration'
  | 'platform'
  | 'multi-agent'
  | 'mcp'
  | 'rag'
  | 'memory'
  | 'eval'
  | 'observability'
  | 'deploy'

export interface AgentRadarProject {
  id: string
  /** 展示名称 */
  name: string
  /** GitHub owner/repo */
  repo: string
  category: RadarCategory
  description: string
  /** 值得关注的原因 */
  whyWatch: string
  /** 部署难度 1-5 */
  deploymentDifficulty: 1 | 2 | 3 | 4 | 5
  /** 企业使用风险 1-5 + 说明 */
  enterpriseRisk: { level: 1 | 2 | 3 | 4 | 5; note: string }
  /** 静态兜底 license（API 成功时被覆盖） */
  license: string
  /** 静态兜底语言（API 成功时被覆盖） */
  language: string
  /** 以下由 API 填充 */
  stars?: number
  /** 近 7 日 star 增长（服务端每日快照），null=跟踪中 */
  starsDelta7d?: number | null
  forks?: number
  latestRelease?: string | null
  pushedAt?: string | null
  openIssues?: number
  issuesActivity?: 'high' | 'medium' | 'low' | null
}

export const RADAR_CATEGORIES: { key: RadarCategory; en: string; zh: string }[] = [
  { key: 'orchestration', en: 'Orchestration', zh: 'Agent 编排' },
  { key: 'platform', en: 'Enterprise Platform', zh: '企业级 Agent 平台' },
  { key: 'multi-agent', en: 'Multi-Agent', zh: '多智能体' },
  { key: 'mcp', en: 'MCP & Tools', zh: 'MCP 与工具调用' },
  { key: 'rag', en: 'RAG & Knowledge', zh: 'RAG 与知识库' },
  { key: 'memory', en: 'Memory', zh: 'Memory' },
  { key: 'eval', en: 'Agent Eval', zh: 'Agent 评测' },
  { key: 'observability', en: 'Observability', zh: '可观测性' },
  { key: 'deploy', en: 'Local Deploy', zh: '本地部署与推理优化' },
]

export const AGENT_RADAR_PROJECTS: AgentRadarProject[] = [
  // —— Agent 编排 ——
  {
    id: 'langgraph', name: 'LangGraph', repo: 'langchain-ai/langgraph', category: 'orchestration',
    description: '状态图驱动的 Agent 编排框架（LangChain 团队）',
    whyWatch: 'LangChain 生态核心，langgraph 平台化（studio/cloud）推进最快，社区规模大',
    deploymentDifficulty: 3, enterpriseRisk: { level: 3, note: '框架迭代快，API 变动频繁，需锁定版本' },
    license: 'MIT', language: 'Python',
  },
  {
    id: 'pydantic-ai', name: 'Pydantic AI', repo: 'pydantic/pydantic-ai', category: 'orchestration',
    description: '类型安全的 Python Agent 框架，结构化输出 + MCP 支持',
    whyWatch: '类型安全设计适合工程团队，2025 年后增长极快，成为企业 Python Agent 新选择',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: '较年轻但依赖成熟（Pydantic v2）' },
    license: 'MIT', language: 'Python',
  },
  {
    id: 'langchain', name: 'LangChain', repo: 'langchain-ai/langchain', category: 'orchestration',
    description: 'LLM 应用开发综合框架（链/工具/记忆/集成）',
    whyWatch: '生态最广（数千集成），仍是企业 LLM 应用主流底座',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: '成熟稳定，但体积大、抽象多' },
    license: 'MIT', language: 'Python',
  },
  // —— 企业级 Agent 平台 ——
  {
    id: 'dify', name: 'Dify', repo: 'langgenius/dify', category: 'platform',
    description: '开源 LLM 应用/Agent 平台：可视化编排 + RAG + 工作流 + 观测',
    whyWatch: '企业落地最热门的开源平台，内置可观测与权限，商用友好',
    deploymentDifficulty: 3, enterpriseRisk: { level: 2, note: '功能齐全但自托管部署链路较重' },
    license: 'Apache-2.0', language: 'TypeScript',
  },
  {
    id: 'n8n', name: 'n8n', repo: 'n8n-io/n8n', category: 'platform',
    description: '可编程工作流自动化平台，Agent 节点 + MCP 支持',
    whyWatch: '从自动化扩展到 Agent 编排，fair-code 许可需注意商用条款',
    deploymentDifficulty: 2, enterpriseRisk: { level: 3, note: 'fair-code（Sustainable Use License）商用需评估' },
    license: 'Sustainable Use License', language: 'TypeScript',
  },
  {
    id: 'flowise', name: 'Flowise', repo: 'FlowiseAI/Flowise', category: 'platform',
    description: '低代码 LLM 流程构建（拖拽编排 Agent/Chain/RAG）',
    whyWatch: '低代码门槛低，原型验证快；生产级能力弱于 Dify',
    deploymentDifficulty: 2, enterpriseRisk: { level: 3, note: '生产级特性较少，需自建加固' },
    license: 'Apache-2.0', language: 'TypeScript',
  },
  // —— 多智能体 ——
  {
    id: 'autogen', name: 'AutoGen', repo: 'microsoft/autogen', category: 'multi-agent',
    description: '微软多智能体框架（AgentChat / Magentic-One）',
    whyWatch: '微软官方支持，Magentic-One 是研究基线；架构 2024 重构后 API 稳定',
    deploymentDifficulty: 3, enterpriseRisk: { level: 2, note: '微软背书，企业采用记录良好' },
    license: 'MIT', language: 'Python',
  },
  {
    id: 'crewai', name: 'CrewAI', repo: 'crewAIInc/crewAI', category: 'multi-agent',
    description: '角色化多智能体编排（Crews / Roles / Tasks / Flows）',
    whyWatch: '抽象直观，企业采用率高；依赖较多需注意性能',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: 'API 偶有破坏性变更' },
    license: 'MIT', language: 'Python',
  },
  {
    id: 'metagpt', name: 'MetaGPT', repo: 'geekan/MetaGPT', category: 'multi-agent',
    description: '多智能体软件公司（SOP 流程驱动的协作式开发）',
    whyWatch: '中文社区影响力大，研究价值高；生产落地场景有限',
    deploymentDifficulty: 4, enterpriseRisk: { level: 4, note: '研究属性强，工程化与维护活跃度波动' },
    license: 'MIT', language: 'Python',
  },
  // —— MCP 与工具调用 ——
  {
    id: 'mcp', name: 'Model Context Protocol', repo: 'modelcontextprotocol/modelcontextprotocol', category: 'mcp',
    description: 'Anthropic 发起的模型上下文协议（工具接入事实标准）',
    whyWatch: '协议层标准，2025 年几乎所有 Agent 框架/平台接入，方向确定',
    deploymentDifficulty: 2, enterpriseRisk: { level: 1, note: '协议开源，生态正快速收敛' },
    license: 'MIT', language: 'Markdown',
  },
  {
    id: 'mcp-servers', name: 'MCP Servers（官方参考实现）', repo: 'modelcontextprotocol/servers', category: 'mcp',
    description: '官方参考 server 集合（filesystem/git/brave 等）',
    whyWatch: '接入 MCP 的首选参考实现，安全实践的风向标',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: '部分 server 仍标记实验性' },
    license: 'MIT', language: 'TypeScript',
  },
  {
    id: 'openai-agents', name: 'OpenAI Agents SDK', repo: 'openai/openai-agents-python', category: 'mcp',
    description: 'OpenAI 官方 Agent SDK（handoffs + MCP + guardrails）',
    whyWatch: 'OpenAI 官方路线，与 Responses API 深度绑定，生态影响力大',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: '绑定 OpenAI 生态，迁移成本需评估' },
    license: 'MIT', language: 'Python',
  },
  // —— RAG 与知识库 ——
  {
    id: 'llama-index', name: 'LlamaIndex', repo: 'run-llama/llama_index', category: 'rag',
    description: 'RAG 与 Agent 数据框架（50+ 连接器，多模式检索）',
    whyWatch: 'RAG 深度最强（含 agentic RAG），文档与生态完善',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: '核心成熟，高级特性需自建' },
    license: 'MIT', language: 'Python',
  },
  {
    id: 'qdrant', name: 'Qdrant', repo: 'qdrant/qdrant', category: 'rag',
    description: '向量数据库（Rust），RAG 检索基础设施',
    whyWatch: '性能与过滤能力领先，云/自托管双模式，RAG 选型高频候选',
    deploymentDifficulty: 3, enterpriseRisk: { level: 1, note: '成熟稳定，商业化与开源并存' },
    license: 'Apache-2.0', language: 'Rust',
  },
  {
    id: 'milvus', name: 'Milvus', repo: 'milvus-io/milvus', category: 'rag',
    description: '开源向量数据库（Zilliz），大规模检索场景',
    whyWatch: '海量数据场景能力强，国内社区活跃',
    deploymentDifficulty: 4, enterpriseRisk: { level: 2, note: '组件多、部署较复杂，托管版需评估' },
    license: 'Apache-2.0', language: 'Go',
  },
  // —— Memory ——
  {
    id: 'mem0', name: 'Mem0', repo: 'mem0ai/mem0', category: 'memory',
    description: 'Agent 记忆层（长期记忆，向量+图混合检索）',
    whyWatch: '记忆层头部项目，多框架集成，托管版与开源并存',
    deploymentDifficulty: 3, enterpriseRisk: { level: 3, note: '记忆质量依赖底层模型，成本与隐私需评估' },
    license: 'Apache-2.0', language: 'Python',
  },
  {
    id: 'letta', name: 'Letta（MemGPT）', repo: 'letta-ai/letta', category: 'memory',
    description: '记忆型 Agent 服务器（MemGPT 延续）',
    whyWatch: '记忆架构研究前沿，自托管 Agent 服务器形态新颖',
    deploymentDifficulty: 4, enterpriseRisk: { level: 4, note: '较年轻，生产案例少' },
    license: 'Apache-2.0', language: 'Python',
  },
  // —— Agent 评测 ——
  {
    id: 'swe-bench', name: 'SWE-bench', repo: 'princeton-nlp/SWE-bench', category: 'eval',
    description: '软件工程 Agent 评测基准（真实 GitHub issue 修复）',
    whyWatch: '编码 Agent 能力事实标准之一，各厂商引用最频繁',
    deploymentDifficulty: 4, enterpriseRisk: { level: 1, note: '纯评测数据，无运行时风险' },
    license: 'MIT', language: 'Python',
  },
  {
    id: 'gaia', name: 'GAIA', repo: 'huggingface/gaia-benchmark', category: 'eval',
    description: '通用 AI 助手基准（HuggingFace/Meta）',
    whyWatch: '通用 Agent 能力评测，多模态/工具/推理综合',
    deploymentDifficulty: 3, enterpriseRisk: { level: 1, note: '评测集维护由 HF 社区驱动' },
    license: 'Apache-2.0', language: 'Python',
  },
  {
    id: 'agentbench', name: 'AgentBench', repo: 'THUDM/AgentBench', category: 'eval',
    description: '智谱/清华的多任务 Agent 评测框架',
    whyWatch: '中文 Agent 评测重要参考，覆盖 8 类任务',
    deploymentDifficulty: 4, enterpriseRisk: { level: 1, note: '学术评测为主' },
    license: 'Apache-2.0', language: 'Python',
  },
  // —— 可观测性 ——
  {
    id: 'langfuse', name: 'Langfuse', repo: 'langfuse/langfuse', category: 'observability',
    description: 'LLM 可观测性/追踪平台（OpenTelemetry GenAI 语义）',
    whyWatch: '生产级追踪/评测/提示词管理，自托管与云双模式',
    deploymentDifficulty: 3, enterpriseRisk: { level: 1, note: '成熟，OpenTelemetry 标准兼容' },
    license: 'MIT', language: 'TypeScript',
  },
  {
    id: 'phoenix', name: 'Arize Phoenix', repo: 'Arize-ai/phoenix', category: 'observability',
    description: 'LLM 可观测与评估（Arize 开源）',
    whyWatch: 'Arize 背书，评估（evals）与追踪一体',
    deploymentDifficulty: 3, enterpriseRisk: { level: 2, note: '与 Arize 云产品协同更完整' },
    license: 'Elastic-2.0', language: 'Python',
  },
  // —— 本地部署与推理优化 ——
  {
    id: 'ollama', name: 'Ollama', repo: 'ollama/ollama', category: 'deploy',
    description: '本地大模型运行时，一键部署',
    whyWatch: '本地 Agent 推理首选，桌面/服务器全平台，生态集成广',
    deploymentDifficulty: 1, enterpriseRisk: { level: 2, note: '易用但生产高并发需改造' },
    license: 'MIT', language: 'Go',
  },
  {
    id: 'vllm', name: 'vLLM', repo: 'vllm-project/vllm', category: 'deploy',
    description: '高吞吐推理引擎（PagedAttention），生产部署标准件',
    whyWatch: '生产推理事实标准，OpenAI 兼容服务，与多数框架集成',
    deploymentDifficulty: 4, enterpriseRisk: { level: 1, note: '成熟，需 GPU 与运维能力' },
    license: 'Apache-2.0', language: 'Python',
  },
  {
    id: 'llamacpp', name: 'llama.cpp', repo: 'ggml-org/llama.cpp', category: 'deploy',
    description: 'GGUF 格式本地推理（CPU/边缘设备）',
    whyWatch: '边缘/桌面端 Agent 运行底座，Ollama 底层依赖',
    deploymentDifficulty: 2, enterpriseRisk: { level: 2, note: '功能追新快，C++ 构建需注意' },
    license: 'MIT', language: 'C++',
  },
]
