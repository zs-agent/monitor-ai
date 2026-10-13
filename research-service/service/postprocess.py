"""展示层后处理：修掉上游 writer 的标题污染。

上游 multi_agents/agents/writer.py 的 revise_headers() 只干一件事——把固定槽位
（Introduction / Table of Contents / Conclusion / References）改名，但它把 task 的全部
guidelines 一起喂给模型，于是模型把准则原文当成标签，产出形如：

    ## 引言：说明基于 monitor-ai 监测快照确定分析方向与取证线索，全文使用中文；区分事实与推断…

而且 publisher.generate_layout 在带图示时会插入一个硬编码的英文标题 `## Visualizations`。
这里按语义锚点还原标签（不按固定序号，因为 Visualizations 会插在结论之后）：

- 参考文献 = 最后一个二级标题
- 结论     = `## Visualizations` 之前那个二级标题；没有图示时取倒数第二个
- 引言 / 目录 = 第 1 / 第 2 个二级标题
- `## Visualizations` → `## 可视化`

标签本身已经够短时不动（保留人工定制）。原始报告仍按上游产物原样保存在 runs/*.json，
这里只做展示层规范化；代码块内的 `##` 不计入（按 ``` 围栏跳过）。
"""
from __future__ import annotations

import re

LABEL_INTRODUCTION = "引言"
LABEL_TOC = "目录"
LABEL_CONCLUSION = "结论"
LABEL_REFERENCES = "参考文献"
LABEL_DIAGRAMS = "可视化"
HARDCODED_DIAGRAMS_HEADING = "Visualizations"
MAX_LABEL_LEN = 12


def normalize_report_labels(report: str | None, max_label_len: int = MAX_LABEL_LEN) -> str | None:
    if not report:
        return report

    lines = report.split("\n")
    heading_idx: list[int] = []
    in_fence = False
    for i, line in enumerate(lines):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        # 只认二级标题：### 不算（(?!#) 保证第二个 # 之后不是 #）
        if not in_fence and re.match(r"^##(?!#)\s+\S", line):
            heading_idx.append(i)

    # 上游版式至少含 引言/目录/结论/参考文献 四个槽位；少于四个说明版式变了，宁可不改
    if len(heading_idx) < 4:
        return report

    def heading_text(index: int) -> str:
        return re.sub(r"^##(?!#)\s+", "", lines[index]).strip()

    changed = False

    # 上游硬编码的英文图示标题
    diagram_positions = [pos for pos, idx in enumerate(heading_idx) if heading_text(idx) == HARDCODED_DIAGRAMS_HEADING]
    for pos in diagram_positions:
        lines[heading_idx[pos]] = f"## {LABEL_DIAGRAMS}"
        changed = True

    if diagram_positions and diagram_positions[0] > 0:
        conclusion_pos = diagram_positions[0] - 1
    else:
        conclusion_pos = len(heading_idx) - 2

    slots = {
        heading_idx[0]: LABEL_INTRODUCTION,
        heading_idx[1]: LABEL_TOC,
        heading_idx[conclusion_pos]: LABEL_CONCLUSION,
        heading_idx[-1]: LABEL_REFERENCES,
    }
    for index, label in slots.items():
        current = heading_text(index)
        if current == LABEL_DIAGRAMS:
            continue  # 槽位与图示标题撞车（理论上不会发生），不动
        if len(current) > max_label_len:
            lines[index] = f"## {label}"
            changed = True

    return "\n".join(lines) if changed else report
