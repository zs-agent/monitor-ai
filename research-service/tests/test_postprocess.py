"""展示层标题规范化的回归测试。

上游 writer 的 revise_headers 会把 guidelines 原文写进固定槽位标题，
而 publisher 在带图示时还会插入英文 `## Visualizations`——这两点都必须按语义锚点处理，
不能按固定序号，否则会把 section 标题或插图标题改坏。
"""
from service.postprocess import normalize_report_labels


def level2(report: str) -> list[str]:
    return [line.strip() for line in report.split("\n") if line.startswith("## ")]


VERBOSE = """# 技术情报报告
#### Date: 12/10/2026

## 引言：说明基于 monitor-ai 监测快照确定分析方向与取证线索，全文使用中文
引言正文

## 目录：一、信号；二、事实；三、推断
- 一、信号

## 路由作为独立控制平面
章节正文

## 结论：回答这意味着什么，不直接复述信号标题
结论正文

## References: 仅列可核验来源链接
- [来源](https://example.com)
"""

WITH_DIAGRAM = VERBOSE.replace(
    "## References: 仅列可核验来源链接",
    "## Visualizations\n```mermaid\nflowchart TD\n  A-->B\n```\n\n## References: 仅列可核验来源链接",
)

ALREADY_SHORT = """# 报告
#### Date: 12/10/2026

## 引言
正文

## 目录
- 一

## 章节一
正文

## 结论
正文

## 参考文献
- [来源](https://example.com)
"""


def test_verbose_labels_become_short():
    out = normalize_report_labels(VERBOSE)
    assert level2(out) == ["## 引言", "## 目录", "## 路由作为独立控制平面", "## 结论", "## 参考文献"]


def test_diagram_heading_is_localized_and_conclusion_found_before_it():
    out = normalize_report_labels(WITH_DIAGRAM)
    assert level2(out) == [
        "## 引言",
        "## 目录",
        "## 路由作为独立控制平面",
        "## 结论",
        "## 可视化",
        "## 参考文献",
    ]


def test_body_is_untouched():
    strip_labels = lambda text: "\n".join(line for line in text.split("\n") if not line.startswith("## "))
    assert strip_labels(normalize_report_labels(WITH_DIAGRAM)) == strip_labels(WITH_DIAGRAM)


def test_short_labels_are_left_alone():
    assert normalize_report_labels(ALREADY_SHORT) == ALREADY_SHORT
    assert normalize_report_labels(VERBOSE) == normalize_report_labels(normalize_report_labels(VERBOSE))


def test_fewer_than_four_headings_is_untouched():
    partial = "## 引言：很长很长很长的标签文本\n正文\n\n## 结论：同样很长的标签文本\n正文\n"
    assert normalize_report_labels(partial) == partial


def test_third_level_heading_and_fenced_code_are_ignored():
    report = (
        "# 报告\n#### Date: 12/10/2026\n\n"
        "## 引言：很长很长的引言标签文本需要被还原成短标签\n正文\n\n"
        "## 目录：一、信号；二、事实；三、推断\n- 一、信号\n\n"
        "### 深一层的小节\n小节正文\n\n"
        "## 结论：很长很长的结论标签文本需要被还原成短标签\n正文\n\n"
        "## 参考文献：很长很长的参考文献标签文本\n- [来源](https://example.com)\n\n"
        "```md\n## 代码块里的标题\n```\n"
    )
    out = normalize_report_labels(report)
    assert "### 深一层的小节" in out            # 三级标题不动
    assert "## 代码块里的标题" in out            # 围栏内的 ## 不参与槽位识别
    assert "## 引言" in out
    assert "## 参考文献" in out
