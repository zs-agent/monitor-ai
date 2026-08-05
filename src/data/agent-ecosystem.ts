import type { AiLocation } from './ai-locations'

/**
 * 全景 AI Agent 生态地图数据
 * ---------------------------------------------------------------
 * 节点类型：
 *   lab            大模型厂商（模型底座）
 *   agent-project  Agent 开源项目（编排/多智能体/MCP/RAG/Memory/Eval/可观测/部署）
 *   agent-platform 企业级 Agent 平台（低代码/工作流/托管）
 *   infra          基础设施（MCP 协议、向量库、评测基准、推理引擎等）
 * 连线类型（技术关系）：
 *   mcp     基于 MCP 协议接入
 *   rag     知识库/检索增强
 *   memory  记忆层集成
 *   eval    评测基准关联
 *   deploy  部署/推理链路
 *   infra   基础设施依赖
 *   compete / partner / collab  竞争 / 合作 / 研究协作
 * ---------------------------------------------------------------
 * 说明：坐标为示意（项目取主要维护者/公司所在区域），非精确位置。
 * 数据为人工梳理的精选清单，未覆盖全部生态；缺失部分以空状态呈现。
 */

export type EcoSubtype =
  | 'orchestration'
  | 'multi-agent'
  | 'mcp'
  | 'rag'
  | 'memory'
  | 'eval'
  | 'observability'
  | 'deploy'
  | 'inference'
  | 'platform'
  | 'frontier'

export type EcoConnectionType = 'mcp' | 'rag' | 'memory' | 'eval' | 'deploy' | 'infra' | 'compete' | 'partner' | 'collab'

export interface EcoConnection {
  from: string
  to: string
  type: EcoConnectionType
}

/** 大模型厂商（lab） */
const LABS: AiLocation[] = [
  {
    id: 'lab-openai', name: 'OpenAI', nameZh: 'OpenAI', lat: 37.7749, lng: -122.4194,
    type: 'lab', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5, models: [],
    description: 'GPT 系列模型，Agent 工具调用与 Responses API 生态核心',
    ecosystem: { subtype: 'frontier', home: 'https://openai.com', techRelations: ['openai', 'gpt', 'chatgpt', 'responses api', 'agents'] },
  },
  {
    id: 'lab-anthropic', name: 'Anthropic', nameZh: 'Anthropic', lat: 37.7935, lng: -122.3929,
    type: 'lab', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5, models: [],
    description: 'Claude 系列，MCP 协议发起方，Agent 能力（computer use）代表',
    ecosystem: { subtype: 'frontier', home: 'https://anthropic.com', techRelations: ['anthropic', 'claude', 'mcp', 'computer use'] },
  },
  {
    id: 'lab-google', name: 'Google DeepMind', nameZh: '谷歌 DeepMind', lat: 37.4221, lng: -122.0841,
    type: 'lab', country: 'US', city: 'Mountain View', cityZh: '山景城', importance: 5, models: [],
    description: 'Gemini 系列，Agentic 搜索与 A2A 协议推动者',
    ecosystem: { subtype: 'frontier', home: 'https://deepmind.google', techRelations: ['gemini', 'google', 'a2a', 'deepmind'] },
  },
  {
    id: 'lab-meta', name: 'Meta AI', nameZh: 'Meta AI', lat: 37.4848, lng: -122.1482,
    type: 'lab', country: 'US', city: 'Menlo Park', cityZh: '门洛帕克', importance: 5, models: [],
    description: 'Llama 系列开源模型，Agent 工具调用标准推进者',
    ecosystem: { subtype: 'frontier', home: 'https://ai.meta.com', techRelations: ['llama', 'meta'] },
  },
  {
    id: 'lab-mistral', name: 'Mistral AI', nameZh: 'Mistral AI', lat: 48.8566, lng: 2.3522,
    type: 'lab', country: 'FR', city: 'Paris', cityZh: '巴黎', importance: 3, models: [],
    description: '欧洲开源模型厂商，Agent 能力（Mistral Agents）',
    ecosystem: { subtype: 'frontier', home: 'https://mistral.ai', techRelations: ['mistral'] },
  },
  {
    id: 'lab-deepseek', name: 'DeepSeek', nameZh: 'DeepSeek', lat: 30.2741, lng: 120.1551,
    type: 'lab', country: 'CN', city: 'Hangzhou', cityZh: '杭州', importance: 5, models: [],
    description: 'V3/R1 系列，推理模型与 MoE 架构代表，开源权重',
    ecosystem: { subtype: 'frontier', home: 'https://deepseek.com', techRelations: ['deepseek', 'r1', 'v3'] },
  },
  {
    id: 'lab-qwen', name: 'Qwen (Alibaba)', nameZh: '通义千问（阿里）', lat: 30.251, lng: 120.138,
    type: 'lab', country: 'CN', city: 'Hangzhou', cityZh: '杭州', importance: 4, models: [],
    description: 'Qwen 系列开源模型，Agent 能力（Qwen-Agent）与工具调用',
    ecosystem: { subtype: 'frontier', home: 'https://qwenlm.github.io', techRelations: ['qwen', 'alibaba', 'tongyi'] },
  },
  {
    id: 'lab-kimi', name: 'Kimi (Moonshot)', nameZh: '月之暗面 Kimi', lat: 39.958, lng: 116.452,
    type: 'lab', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4, models: [],
    description: 'Kimi K2 系列，Agent 工具调用（Kimi For Coding）',
    ecosystem: { subtype: 'frontier', home: 'https://kimi.moonshot.cn', techRelations: ['kimi', 'moonshot'] },
  },
  {
    id: 'lab-minimax', name: 'MiniMax', nameZh: 'MiniMax', lat: 31.2304, lng: 121.4737,
    type: 'lab', country: 'CN', city: 'Shanghai', cityZh: '上海', importance: 3, models: [],
    description: 'M2 系列，开源 MoE 模型与 Agent 平台',
    ecosystem: { subtype: 'frontier', home: 'https://minimax.io', techRelations: ['minimax', 'm2'] },
  },
  {
    id: 'lab-zhipu', name: 'Zhipu AI', nameZh: '智谱 AI', lat: 39.9042, lng: 116.4074,
    type: 'lab', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4, models: [],
    description: 'GLM 系列，AutoGLM 手机 Agent 与 AgentBench 评测',
    ecosystem: { subtype: 'frontier', home: 'https://zhipuai.cn', techRelations: ['glm', 'zhipu', 'autoglm', 'agentbench'] },
  },
  {
    id: 'lab-doubao', name: 'ByteDance (Doubao)', nameZh: '字节跳动 豆包', lat: 39.956, lng: 116.330,
    type: 'lab', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4, models: [],
    description: '豆包/Seed 系列模型，Coze 平台底座',
    ecosystem: { subtype: 'frontier', home: 'https://www.doubao.com', techRelations: ['doubao', 'bytedance', 'seed', 'coze'] },
  },
]

/** Agent 开源项目（agent-project） */
const AGENT_PROJECTS: AiLocation[] = [
  {
    id: 'proj-langgraph', name: 'LangGraph', nameZh: 'LangGraph', lat: 37.7749, lng: -122.4194,
    type: 'agent-project', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5, models: [],
    description: 'Agent 编排框架（LangChain 团队），状态图驱动的 Agent 工作流',
    ecosystem: { subtype: 'orchestration', github: 'langchain-ai/langgraph', home: 'https://langchain-ai.github.io/langgraph', techRelations: ['langgraph', 'langchain', 'agent'] },
  },
  {
    id: 'proj-openai-agents', name: 'OpenAI Agents SDK', nameZh: 'OpenAI Agents SDK', lat: 37.7749, lng: -122.4194,
    type: 'agent-project', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5, models: [],
    description: 'OpenAI 官方 Agent SDK，Handoffs 多智能体交接机制',
    ecosystem: { subtype: 'multi-agent', github: 'openai/openai-agents-python', home: 'https://openai.github.io/openai-agents-python', techRelations: ['openai', 'agents sdk', 'handoffs'] },
  },
  {
    id: 'proj-autogen', name: 'AutoGen', nameZh: 'AutoGen', lat: 47.6409, lng: -122.1292,
    type: 'agent-project', country: 'US', city: 'Redmond', cityZh: '雷德蒙德', importance: 4, models: [],
    description: '微软多智能体框架，AgentChat 与 Magentic-One 研究基线',
    ecosystem: { subtype: 'multi-agent', github: 'microsoft/autogen', home: 'https://microsoft.github.io/autogen', techRelations: ['autogen', 'magentic-one'] },
  },
  {
    id: 'proj-crewai', name: 'CrewAI', nameZh: 'CrewAI', lat: 38.7223, lng: -9.1393,
    type: 'agent-project', country: 'PT', city: 'Lisbon', cityZh: '里斯本', importance: 4, models: [],
    description: '角色化多智能体编排（Crews/Roles/Tasks），企业采用率高',
    ecosystem: { subtype: 'multi-agent', github: 'crewAIInc/crewAI', home: 'https://www.crewai.com', techRelations: ['crewai', 'crew', 'agent'] },
  },
  {
    id: 'proj-pydantic-ai', name: 'Pydantic AI', nameZh: 'Pydantic AI', lat: 51.5074, lng: -0.1278,
    type: 'agent-project', country: 'UK', city: 'London', cityZh: '伦敦', importance: 4, models: [],
    description: '类型安全 Agent 框架，结构化输出与 MCP 支持',
    ecosystem: { subtype: 'orchestration', github: 'pydantic/pydantic-ai', home: 'https://ai.pydantic.dev', techRelations: ['pydantic', 'agent', 'structured output'] },
  },
  {
    id: 'proj-mcp', name: 'MCP (Model Context Protocol)', nameZh: 'MCP 协议', lat: 37.7935, lng: -122.3929,
    type: 'agent-project', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5, models: [],
    description: 'Anthropic 发起的模型上下文协议，工具接入事实标准',
    ecosystem: { subtype: 'mcp', github: 'modelcontextprotocol/modelcontextprotocol', home: 'https://modelcontextprotocol.io', techRelations: ['mcp', 'model context protocol', 'tool'] },
  },
  {
    id: 'proj-llamaindex', name: 'LlamaIndex', nameZh: 'LlamaIndex', lat: 37.7749, lng: -122.4194,
    type: 'agent-project', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 5, models: [],
    description: 'RAG 与 Agent 数据框架，50+ 数据连接器',
    ecosystem: { subtype: 'rag', github: 'run-llama/llama_index', home: 'https://www.llamaindex.ai', techRelations: ['llamaindex', 'llama index', 'rag'] },
  },
  {
    id: 'proj-mem0', name: 'Mem0', nameZh: 'Mem0', lat: 37.7749, lng: -122.4194,
    type: 'agent-project', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 4, models: [],
    description: 'Agent 记忆层（长期记忆），支持向量+图混合检索',
    ecosystem: { subtype: 'memory', github: 'mem0ai/mem0', home: 'https://mem0.ai', techRelations: ['mem0', 'memory'] },
  },
  {
    id: 'proj-letta', name: 'Letta', nameZh: 'Letta', lat: 37.7749, lng: -122.4194,
    type: 'agent-project', country: 'US', city: 'San Francisco', cityZh: '旧金山', importance: 3, models: [],
    description: 'MemGPT 记忆型 Agent 框架',
    ecosystem: { subtype: 'memory', github: 'letta-ai/letta', home: 'https://www.letta.com', techRelations: ['letta', 'memgpt', 'memory'] },
  },
  {
    id: 'proj-langfuse', name: 'Langfuse', nameZh: 'Langfuse', lat: 52.5200, lng: 13.4050,
    type: 'agent-project', country: 'DE', city: 'Berlin', cityZh: '柏林', importance: 4, models: [],
    description: 'LLM 可观测性/追踪平台（OpenTelemetry GenAI 语义约定）',
    ecosystem: { subtype: 'observability', github: 'langfuse/langfuse', home: 'https://langfuse.com', techRelations: ['langfuse', 'observability', 'tracing'] },
  },
  {
    id: 'proj-ollama', name: 'Ollama', nameZh: 'Ollama', lat: 40.7580, lng: -73.9855,
    type: 'agent-project', country: 'US', city: 'New York', cityZh: '纽约', importance: 5, models: [],
    description: '本地大模型运行时，一键部署，Agent 本地推理首选',
    ecosystem: { subtype: 'deploy', github: 'ollama/ollama', home: 'https://ollama.com', techRelations: ['ollama', 'local', 'llm runtime'] },
  },
  {
    id: 'proj-vllm', name: 'vLLM', nameZh: 'vLLM', lat: 37.8719, lng: -122.2585,
    type: 'agent-project', country: 'US', city: 'Berkeley', cityZh: '伯克利', importance: 5, models: [],
    description: '高吞吐推理引擎（PagedAttention），生产部署标准件',
    ecosystem: { subtype: 'inference', github: 'vllm-project/vllm', home: 'https://docs.vllm.ai', techRelations: ['vllm', 'inference', 'deploy'] },
  },
  {
    id: 'proj-llamacpp', name: 'llama.cpp', nameZh: 'llama.cpp', lat: 47.6062, lng: -122.3321,
    type: 'agent-project', country: 'US', city: 'Seattle', cityZh: '西雅图', importance: 4, models: [],
    description: 'GGUF 格式本地推理，边缘设备 Agent 运行底座',
    ecosystem: { subtype: 'inference', github: 'ggml-org/llama.cpp', home: 'https://github.com/ggml-org/llama.cpp', techRelations: ['llama.cpp', 'gguf', 'local'] },
  },
  {
    id: 'proj-swebench', name: 'SWE-bench', nameZh: 'SWE-bench', lat: 37.4275, lng: -122.1697,
    type: 'agent-project', country: 'US', city: 'Stanford', cityZh: '斯坦福', importance: 4, models: [],
    description: '软件工程 Agent 评测基准，Agent 编码能力事实标准之一',
    ecosystem: { subtype: 'eval', github: 'princeton-nlp/SWE-bench', home: 'https://www.swebench.com', techRelations: ['swe-bench', 'swebench', 'eval'] },
  },
  {
    id: 'proj-gaia', name: 'GAIA', nameZh: 'GAIA', lat: 48.8588, lng: 2.3500,
    type: 'agent-project', country: 'FR', city: 'Paris', cityZh: '巴黎', importance: 4, models: [],
    description: '通用 AI 助手基准（HuggingFace/Meta），通用 Agent 能力评测',
    ecosystem: { subtype: 'eval', github: 'huggingface/gaia-benchmark', home: 'https://huggingface.co/gaia-benchmark', techRelations: ['gaia', 'benchmark', 'agent'] },
  },
]

/** 企业级 Agent 平台（agent-platform） */
const AGENT_PLATFORMS: AiLocation[] = [
  {
    id: 'plat-dify', name: 'Dify', nameZh: 'Dify', lat: 22.5431, lng: 114.0579,
    type: 'agent-platform', country: 'CN', city: 'Shenzhen', cityZh: '深圳', importance: 5, models: [],
    description: '开源 LLM 应用/Agent 平台，可视化编排 + RAG + 工作流',
    ecosystem: { subtype: 'platform', github: 'langgenius/dify', home: 'https://dify.ai', techRelations: ['dify', 'workflow', 'agent platform'] },
  },
  {
    id: 'plat-n8n', name: 'n8n', nameZh: 'n8n', lat: 52.5200, lng: 13.4050,
    type: 'agent-platform', country: 'DE', city: 'Berlin', cityZh: '柏林', importance: 4, models: [],
    description: '可编程工作流自动化平台，Agent 节点与 MCP 支持',
    ecosystem: { subtype: 'platform', github: 'n8n-io/n8n', home: 'https://n8n.io', techRelations: ['n8n', 'workflow', 'automation'] },
  },
  {
    id: 'plat-flowise', name: 'Flowise', nameZh: 'Flowise', lat: 40.7128, lng: -74.0060,
    type: 'agent-platform', country: 'US', city: 'New York', cityZh: '纽约', importance: 3, models: [],
    description: '低代码 LLM 流程构建，Agent/Chain 拖拽编排',
    ecosystem: { subtype: 'platform', github: 'FlowiseAI/Flowise', home: 'https://flowiseai.com', techRelations: ['flowise', 'low code'] },
  },
  {
    id: 'plat-coze', name: 'Coze', nameZh: '扣子（Coze）', lat: 39.956, lng: 116.330,
    type: 'agent-platform', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4, models: [],
    description: '字节跳动 Agent 平台，插件生态与商店分发',
    ecosystem: { subtype: 'platform', home: 'https://www.coze.cn', techRelations: ['coze', 'doubao', 'plugin'] },
  },
]

/** 基础设施（infra） */
const INFRA: AiLocation[] = [
  {
    id: 'infra-qdrant', name: 'Qdrant', nameZh: 'Qdrant', lat: 51.5074, lng: -0.1278,
    type: 'infra', country: 'UK', city: 'London', cityZh: '伦敦', importance: 4, models: [],
    description: '向量数据库，RAG 检索基础设施',
    ecosystem: { subtype: 'rag', github: 'qdrant/qdrant', home: 'https://qdrant.tech', techRelations: ['qdrant', 'vector db', 'rag'] },
  },
  {
    id: 'infra-milvus', name: 'Milvus', nameZh: 'Milvus', lat: 39.985, lng: 116.320,
    type: 'infra', country: 'CN', city: 'Beijing', cityZh: '北京', importance: 4, models: [],
    description: '开源向量数据库（Zilliz），大规模 RAG 场景',
    ecosystem: { subtype: 'rag', github: 'milvus-io/milvus', home: 'https://milvus.io', techRelations: ['milvus', 'vector db', 'zilliz'] },
  },
  {
    id: 'infra-hf', name: 'Hugging Face', nameZh: 'Hugging Face', lat: 48.8588, lng: 2.3500,
    type: 'infra', country: 'FR', city: 'Paris', cityZh: '巴黎', importance: 5, models: [],
    description: '模型托管与 Agent 生态（smolagents、MCP 目录、GAIA 评测）',
    ecosystem: { subtype: 'infra', home: 'https://huggingface.co', techRelations: ['huggingface', 'transformers', 'smolagents'] },
  },
  {
    id: 'infra-vector-ai', name: 'LMSYS / Chatbot Arena', nameZh: 'LMSYS 竞技场', lat: 37.8719, lng: -122.2585,
    type: 'infra', country: 'US', city: 'Berkeley', cityZh: '伯克利', importance: 4, models: [],
    description: '模型匿名对战评测（LMArena），模型能力基准来源',
    ecosystem: { subtype: 'eval', home: 'https://lmarena.ai', techRelations: ['lmarena', 'chatbot arena', 'lmsys'] },
  },
  {
    id: 'infra-artificial-analysis', name: 'Artificial Analysis', nameZh: 'Artificial Analysis', lat: 40.7128, lng: -74.0060,
    type: 'infra', country: 'US', city: 'New York', cityZh: '纽约', importance: 3, models: [],
    description: '模型质量/速度/价格独立评测，Index 与 Arena 数据源',
    ecosystem: { subtype: 'eval', home: 'https://artificialanalysis.ai', techRelations: ['artificial analysis', 'benchmark'] },
  },
]

/** 全部生态节点 */
export const ECOSYSTEM_ENTITIES: AiLocation[] = [...LABS, ...AGENT_PROJECTS, ...AGENT_PLATFORMS, ...INFRA]

/** 技术关系连线（引用 ECOSYSTEM_ENTITIES 与既有 AI_HUBS 的 id） */
export const TECH_CONNECTIONS: EcoConnection[] = [
  // 模型厂商 → MCP 生态
  { from: 'lab-openai', to: 'proj-mcp', type: 'mcp' },
  { from: 'lab-anthropic', to: 'proj-mcp', type: 'mcp' },
  { from: 'lab-google', to: 'proj-mcp', type: 'mcp' },
  { from: 'lab-meta', to: 'proj-mcp', type: 'mcp' },
  // Agent 框架 → MCP
  { from: 'proj-langgraph', to: 'proj-mcp', type: 'mcp' },
  { from: 'proj-openai-agents', to: 'proj-mcp', type: 'mcp' },
  { from: 'proj-pydantic-ai', to: 'proj-mcp', type: 'mcp' },
  { from: 'proj-autogen', to: 'proj-mcp', type: 'mcp' },
  { from: 'plat-dify', to: 'proj-mcp', type: 'mcp' },
  { from: 'plat-n8n', to: 'proj-mcp', type: 'mcp' },
  // RAG：框架 ↔ 向量库
  { from: 'proj-llamaindex', to: 'infra-qdrant', type: 'rag' },
  { from: 'proj-llamaindex', to: 'infra-milvus', type: 'rag' },
  { from: 'proj-langgraph', to: 'infra-qdrant', type: 'rag' },
  { from: 'plat-dify', to: 'infra-qdrant', type: 'rag' },
  { from: 'plat-dify', to: 'infra-milvus', type: 'rag' },
  // Memory
  { from: 'proj-mem0', to: 'proj-langgraph', type: 'memory' },
  { from: 'proj-letta', to: 'proj-langgraph', type: 'memory' },
  { from: 'proj-mem0', to: 'proj-llamaindex', type: 'memory' },
  // Eval
  { from: 'proj-swebench', to: 'lab-openai', type: 'eval' },
  { from: 'proj-swebench', to: 'lab-anthropic', type: 'eval' },
  { from: 'proj-swebench', to: 'lab-deepseek', type: 'eval' },
  { from: 'proj-gaia', to: 'lab-openai', type: 'eval' },
  { from: 'infra-vector-ai', to: 'lab-openai', type: 'eval' },
  { from: 'infra-vector-ai', to: 'lab-anthropic', type: 'eval' },
  // 部署 / 推理
  { from: 'proj-ollama', to: 'proj-llamacpp', type: 'deploy' },
  { from: 'proj-vllm', to: 'lab-qwen', type: 'deploy' },
  { from: 'proj-vllm', to: 'lab-meta', type: 'deploy' },
  { from: 'proj-ollama', to: 'lab-qwen', type: 'deploy' },
  { from: 'proj-ollama', to: 'lab-deepseek', type: 'deploy' },
  // 可观测
  { from: 'proj-langfuse', to: 'proj-langgraph', type: 'infra' },
  { from: 'proj-langfuse', to: 'proj-openai-agents', type: 'infra' },
  // 平台 ↔ 模型厂商
  { from: 'plat-dify', to: 'lab-openai', type: 'partner' },
  { from: 'plat-dify', to: 'lab-deepseek', type: 'partner' },
  { from: 'plat-coze', to: 'lab-doubao', type: 'partner' },
  { from: 'proj-openai-agents', to: 'lab-openai', type: 'partner' },
  { from: 'proj-autogen', to: 'lab-meta', type: 'partner' },
  // 竞争
  { from: 'proj-langgraph', to: 'proj-openai-agents', type: 'compete' },
  { from: 'proj-autogen', to: 'proj-crewai', type: 'compete' },
  { from: 'plat-dify', to: 'plat-coze', type: 'compete' },
  { from: 'infra-qdrant', to: 'infra-milvus', type: 'compete' },
  { from: 'proj-ollama', to: 'proj-vllm', type: 'compete' },
  // 研究协作
  { from: 'infra-hf', to: 'proj-gaia', type: 'collab' },
  { from: 'lab-zhipu', to: 'proj-swebench', type: 'collab' },
]

export const ECO_CONN_LABELS: Record<EcoConnectionType, { en: string; zh: string }> = {
  mcp: { en: 'MCP', zh: 'MCP 接入' },
  rag: { en: 'RAG', zh: 'RAG 检索' },
  memory: { en: 'Memory', zh: '记忆集成' },
  eval: { en: 'Eval', zh: '评测关联' },
  deploy: { en: 'Deploy', zh: '部署链路' },
  infra: { en: 'Infra', zh: '基础设施' },
  compete: { en: 'Competition', zh: '竞争' },
  partner: { en: 'Partnership', zh: '合作' },
  collab: { en: 'Research', zh: '研究协作' },
}

export const ECO_CONN_COLORS: Record<EcoConnectionType, string> = {
  mcp: '#06b6d4',
  rag: '#34d399',
  memory: '#a78bfa',
  eval: '#f59e0b',
  deploy: '#fb7185',
  infra: '#94a3b8',
  compete: '#ef4444',
  partner: '#38bdf8',
  collab: '#c084fc',
}

export const ECO_SUBTYPE_LABELS: Record<EcoSubtype, { en: string; zh: string }> = {
  orchestration: { en: 'Orchestration', zh: 'Agent 编排' },
  'multi-agent': { en: 'Multi-Agent', zh: '多智能体' },
  mcp: { en: 'MCP / Tools', zh: 'MCP 与工具' },
  rag: { en: 'RAG', zh: 'RAG 与知识库' },
  memory: { en: 'Memory', zh: 'Memory' },
  eval: { en: 'Eval', zh: 'Agent 评测' },
  observability: { en: 'Observability', zh: '可观测性' },
  deploy: { en: 'Deploy', zh: '本地部署' },
  inference: { en: 'Inference', zh: '推理优化' },
  platform: { en: 'Platform', zh: '企业平台' },
  frontier: { en: 'Frontier Lab', zh: '前沿模型' },
}
