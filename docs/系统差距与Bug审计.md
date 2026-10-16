# 现有系统差距分析与 Bug 审计清单

审计起点：已有结构化初版，工作树包含前期论文配套修改；保留这些修改。

| 位置 | 问题及影响 | 改造要求 |
|---|---|---|
| research_state.py | 四类任务使用旧枚举；缺关联得分、过滤原因与显式依赖边 | 规范枚举并兼容历史输入；记录关联漏斗、Q/E/C/R |
| research_state.py | 指纹包含来源身份，转载不能识别；同URL按Hash大小挑选无时间含义 | 指纹仅标题/正文/时间；确定性首次保留，记录重复 |
| research_state.py | 非数组claims/checks可能崩溃；文本内虚构URL绕过引用键检查 | 验证数组、过滤来源及正文URL、保留拒绝记录 |
| structured_workflow.py | 执行合并为一个节点；缺固定/单角色/全量对照及开销日志 | 独立规划、研究、核查、整合节点；预算一致，独立实验落盘 |
| app.py/signals.py | 缺快照/空信号导致未受控500；无法注入受控快照 | 受控快照参数，空快照仍可专题研究 |
| app.py/runner.py | 终止事件早于落盘；取消丢动作账本；文件写入非原子；订阅队列无上限 | 终态完成持久化后广播，保留部分状态，原子保存与有界队列 |
| ResearchWorkspace.tsx | SSE断开只提示；历史选择竞态；重复启动与未捕获请求错误 | 状态轮询兜底、请求代际、启动锁与明确错误 |
| Markdown渲染/反代 | LLM链接可含危险协议；代理未传取消信号 | 限制HTTP(S)，传递请求取消 |
| 前端研究工作台 | 三大机制仅原始JSON，缺预览与证据交互 | 漏斗、候选动作、差分与可展开依赖证据 |

验证边界：静态扫描和回归测试不能证明不存在所有潜在Bug；外部模型效果须真实受控实验测量。


## 修复结果与验证

- 已实现规范任务/动作枚举、关联清洗解释、Q/E/C/R与引用版本、独立规划/研究/核查/整合节点、回溯指针MCKP、五种对照/消融设置及实验落盘。
- 已修复SSE断开Loading、重复启动/历史竞态、取消记账、失败研究误核查旧结论、非数组模型输出、正文虚构URL、非HTTP链接、快照缺失与不规范数值、同URL版本冲突、历史证据被覆盖、文件保存失败无终态、服务重启中断记录、无界内存队列、监测刷新覆盖与数据丢失、洞察异常和旧内容误刷新、CLI JSON输出被吞、模型名称二次URL解码，以及旧CLI默认黑盒流程。
- Next升级到15.5.27，异步params适配；运行时依赖审计由6项（含严重漏洞）降至0项。开发工具链另有9项，见下。
- 第一方源码清单117文件约15,103行（后续小改后行数略增），包含全部Python AST检查及全前端TypeScript检查；不把venv、node_modules和整个第三方上游源码宣称为逐行人工审查。
- 后端pytest：43通过；前端Vitest：38通过；tsc、lint、Next生产构建通过。用例含穷举核对MCKP、稳定零调用、变化/缺失影响、原文版本保留、预算0、失败/取消、私网来源、重启恢复与落盘失败终态。
- 真实模型 + 官方资料冻结烟测：首轮2问题全部完成、4动作；稳定后续版2问题沿用、0动作。真实用量见运行记录；未运行完整论文统计实验、未声称算法有显著质量提升。

## 仍存在的边界

| 项目 | 当前状态 |
|---|---|
| 开发依赖9项安全告警 | braces目前审计范围覆盖所有版本，牵连Tailwind/fast-glob/micromatch及ESLint工具链；另有选择器解析器告警。与运行时0项分开记录，完整修复需要工具链迁移并重新做样式回归 |
| 外部检索可用性 | 已处理超时、空内容、失败，但外部限流不能由本仓库保证消除 |
| 爬虫网络边界 | 已拒绝直接私网地址；上游爬虫重定向与DNS重绑定需部署出口隔离，不宣称完整SSRF沙箱 |
| 多进程/分布式 | 当前为单进程本地运行，未实现跨worker共享运行句柄；实验适用同一服务进程 |
| 质量与新颖性 | 自动核查不等于客观真值。真实对照矩阵、人工标注及显著性检验尚需正式开展 |

## 前端验收

入口：`http://127.0.0.1:3100/nexus?tab=research`。验证流程：预览关联 → 切预算面板 → 切状态差分 → 选择真实历史 → 点击图中来源节点显示原文。检查桌面1440×1100与移动390×844、页面非空、无框架错误覆盖、控制台错误及交互状态变化。截图保存在本次任务验证目录，未向Git仓库提交测试截图。

## 修改文件清单

- `.gitignore`
- `docs/系统差距与Bug审计.md`
- `next-env.d.ts`
- `next.config.js`
- `package-lock.json`
- `package.json`
- `research-service/README.md`
- `research-service/experiment.py`
- `research-service/requirements.txt`
- `research-service/run_task.py`
- `research-service/service/app.py`
- `research-service/service/evolution.py`
- `research-service/service/research_state.py`
- `research-service/service/runner.py`
- `research-service/service/safe_sources.py`
- `research-service/service/signals.py`
- `research-service/service/structured_workflow.py`
- `research-service/tests/test_adversarial_workflow.py`
- `research-service/tests/test_research_state.py`
- `research-service/tests/test_structured_api.py`
- `src/app/api/research/[[...path]]/route.ts`
- `src/app/entity/[kind]/[slug]/page.tsx`
- `src/app/model/[name]/page.tsx`
- `src/components/research/AgentTimeline.tsx`
- `src/components/research/Composer.tsx`
- `src/components/research/DependencyGraph.tsx`
- `src/components/research/HistoryList.tsx`
- `src/components/research/MechanismView.tsx`
- `src/components/research/MermaidBlock.tsx`
- `src/components/research/ResearchWorkspace.tsx`
- `src/components/research/agentMap.ts`
- `src/lib/__tests__/markdown.test.tsx`
- `src/lib/aggregate.ts`
- `src/lib/insights/pipeline.ts`
- `src/lib/insights/types.ts`
- `src/lib/markdown.tsx`
- `src/lib/use-remote-data.ts`
- `tsconfig.json`

运行演示还会更新data中的监测缓存和tsconfig.tsbuildinfo；这些是运行产物，不是算法修改。


## 修复结果与验证

- 已实现规范任务/动作枚举、关联清洗解释、Q/E/C/R与引用版本、独立规划/研究/核查/整合节点、回溯指针MCKP、五种对照/消融设置及实验落盘。
- 已修复SSE断开Loading、重复启动/历史竞态、取消记账、失败研究误核查旧结论、非数组模型输出、正文虚构URL、非HTTP链接、快照缺失与不规范数值、同URL版本冲突、历史证据被覆盖、文件保存失败无终态、服务重启中断记录、无界内存队列、监测刷新覆盖与数据丢失、洞察异常和旧内容误刷新、CLI JSON输出被吞、模型名称二次URL解码，旧CLI默认黑盒流程及旧报告布局污染结构化问题标题。
- Next升级到15.5.27，异步params适配；运行时依赖审计由6项（含严重漏洞）降至0项。开发工具链另有9项，见下。
- 第一方源码清单117文件约15,103行（后续小改后行数略增），包含全部Python AST检查及全前端TypeScript检查；不把venv、node_modules和整个第三方上游源码宣称为逐行人工审查。
- 后端pytest：44通过；前端Vitest：38通过；tsc、lint、Next生产构建通过。用例含穷举核对MCKP、稳定零调用、变化/缺失影响、原文版本保留、预算0、失败/取消、私网来源、重启恢复与落盘失败终态。
- 真实模型 + 官方资料冻结烟测：首轮2问题全部完成、4动作；稳定后续版2问题沿用、0动作。真实用量见运行记录；未运行完整论文统计实验、未声称算法有显著质量提升。

## 仍存在的边界

| 项目 | 当前状态 |
|---|---|
| 开发依赖9项安全告警 | braces目前审计范围覆盖所有版本，牵连Tailwind/fast-glob/micromatch及ESLint工具链；另有选择器解析器告警。与运行时0项分开记录，完整修复需要工具链迁移并重新做样式回归 |
| 外部检索可用性 | 已处理超时、空内容、失败，但外部限流不能由本仓库保证消除 |
| 爬虫网络边界 | 已拒绝直接私网地址；上游爬虫重定向与DNS重绑定需部署出口隔离，不宣称完整SSRF沙箱 |
| 多进程/分布式 | 当前为单进程本地运行，未实现跨worker共享运行句柄；实验适用同一服务进程 |
| 质量与新颖性 | 自动核查不等于客观真值。真实对照矩阵、人工标注及显著性检验尚需正式开展 |

## 前端验收

入口：`http://127.0.0.1:3100/nexus?tab=research`。验证流程：预览关联 → 切预算面板 → 切状态差分 → 选择真实历史 → 点击图中来源节点显示原文。检查桌面1440×1100与移动390×844、页面非空、无框架错误覆盖、控制台错误及交互状态变化。截图保存在本次任务验证目录，未向Git仓库提交测试截图。

## 修改文件清单

- `.gitignore`
- `docs/系统差距与Bug审计.md`
- `next-env.d.ts`
- `next.config.js`
- `package-lock.json`
- `package.json`
- `research-service/README.md`
- `research-service/experiment.py`
- `research-service/requirements.txt`
- `research-service/run_task.py`
- `research-service/service/app.py`
- `research-service/service/evolution.py`
- `research-service/service/research_state.py`
- `research-service/service/runner.py`
- `research-service/service/safe_sources.py`
- `research-service/service/signals.py`
- `research-service/service/structured_workflow.py`
- `research-service/tests/test_adversarial_workflow.py`
- `research-service/tests/test_research_state.py`
- `research-service/tests/test_structured_api.py`
- `src/app/api/research/[[...path]]/route.ts`
- `src/app/entity/[kind]/[slug]/page.tsx`
- `src/app/model/[name]/page.tsx`
- `src/components/research/AgentTimeline.tsx`
- `src/components/research/Composer.tsx`
- `src/components/research/DependencyGraph.tsx`
- `src/components/research/HistoryList.tsx`
- `src/components/research/MechanismView.tsx`
- `src/components/research/MermaidBlock.tsx`
- `src/components/research/ResearchWorkspace.tsx`
- `src/components/research/agentMap.ts`
- `src/lib/__tests__/markdown.test.tsx`
- `src/lib/aggregate.ts`
- `src/lib/insights/pipeline.ts`
- `src/lib/insights/types.ts`
- `src/lib/markdown.tsx`
- `src/lib/use-remote-data.ts`
- `tsconfig.json`

运行演示还会更新data中的监测缓存和tsconfig.tsbuildinfo；这些是运行产物，不是算法修改。
\n最终反代接口烟测：preview、run、history、SSE终止与跨站POST拒绝均通过。\n

### 观测中枢地图兼容性修复（2026-10-14）

Next.js 升级后，旧版 React Leaflet 的地图引用回调重复初始化容器，导致看板报错 Map container is already initialized。已将 React / React DOM 与 React Leaflet 升级为兼容版本，采用上游地图实例引用保护。

验证：看板与情报研究往返切换三轮、地图重置均正常；TypeScript、ESLint、38 项前端测试及生产构建通过，运行时依赖审计为 0 项漏洞。
