"""情报岗位作业（自有层）：不改上游协作图，在报告产出后追加一轮"情报加工"。

岗位按真实职衔 + 情报周期（Intelligence Cycle）设置，作业标准取自同行方法：

| 岗位              | 周期环节 | 作业标准                     | 交付物                             |
|------------------|---------|-----------------------------|-----------------------------------|
| 情报需求分析师     | 需求     | KIQ / RIR                   | 关键情报问题 + 取证要求 + 采集计划   |
| 开源情报采集员     | 采集     | Admiralty Code（A–F × 1–6） | 证据台账（来源分级 + 支撑结论 + 缺口）|
| 情报审核员         | 质检     | 证据绑定 + 一致性            | 引用可验证率 + 无源结论 + 待反驳项   |

LLM 调用复用上游的 `call_model`（同一套 .env 配置：deepseek:deepseek-flash），
每个岗位一次调用，秒级；不跑完整研究流程，所以迭代便宜。
"""
from __future__ import annotations

import json
import re
import time

from multi_agents.agents.utils.llms import call_model

# ---------------------------------------------------------------- 报告解析（机械部分）

LINK_RE = re.compile(r"\[[^\]]+\]\((https?://[^)\s]+)\)")
SENTENCE_SPLIT_RE = re.compile(r"(?<=[。！？；;.!?])\s*")
MARKDOWN_LABEL_RE = re.compile(r"[*`#>\[\]()]")


def iter_sections(report: str, max_sections: int = 12, max_chars: int = 1200) -> list[dict]:
    """按二级标题切分报告正文，截断后供岗位作业使用。"""
    sections: list[dict] = []
    current: dict | None = None
    in_fence = False
    for line in report.split("\n"):
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if not in_fence and re.match(r"^##(?!#)\s+\S", line):
            current = {"heading": line.lstrip("# ").strip(), "body": []}
            sections.append(current)
            continue
        if current is not None:
            current["body"].append(line)
    return [
        {"heading": s["heading"], "text": "\n".join(s["body"]).strip()[:max_chars]}
        for s in sections[:max_sections]
        if s["heading"]
    ]


def extract_sources(report: str) -> list[dict]:
    """抽取报告引用过的外部来源（去重，按出现顺序）。"""
    seen: dict[str, dict] = {}
    for match in LINK_RE.finditer(report):
        url = match.group(1).rstrip(".,)")
        if url in seen:
            seen[url]["mentions"] += 1
            continue
        domain = re.sub(r"^https?://", "", url).split("/")[0]
        seen[url] = {"url": url, "domain": domain, "mentions": 1}
    return list(seen.values())


def citation_stats(report: str, min_chars: int = 24) -> dict:
    """段落级引用可验证率：够长的段落里，含 markdown 链接的算"可核验"。

    这是机械口径（不判断链接是否真的支撑该结论），所以把口径一起返回，避免过度解读。
    """
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", report) if p.strip()]
    claims = [p for p in paragraphs if len(MARKDOWN_LABEL_RE.sub("", p)) >= min_chars and not p.lstrip().startswith(("#", "```", "|", "-", "*"))]
    with_citation = [p for p in claims if LINK_RE.search(p)]
    stripped = [p for p in claims if not LINK_RE.search(p)]
    return {
        "method": f"段落级：正文段落（≥{min_chars} 字、非标题/表格/列表）中含 markdown 链接即视为可核验",
        "claims_total": len(claims),
        "claims_with_citation": len(with_citation),
        "citation_rate": round(len(with_citation) / len(claims), 3) if claims else 0.0,
        "claims_without_citation": [MARKDOWN_LABEL_RE.sub("", p)[:120] for p in stripped[:10]],
    }


# ---------------------------------------------------------------- 三个岗位的提示词

REQUIREMENTS_SYSTEM = (
    "你是技术情报部门的情报需求分析师，负责把监测到的技术信号转成可执行的关键情报问题（KIQ，Key Intelligence Questions）。"
    "KIQ 必须指向决策（技术选型、投入、风险规避），不要写成「介绍一下 X」这种百科式问题。"
)

REQUIREMENTS_SCHEMA = """{
  "kiqs": [
    {"id": "KIQ-1", "question": "…", "why_it_matters": "…",
     "evidence_required": ["…"], "priority": "high|medium|low",
     "answerable_from": ["academic|news|vendor|repo|policy"]}
  ],
  "collection_plan": ["先查什么、再查什么"],
  "out_of_scope": ["明确不查的"]
}"""

COLLECTOR_SYSTEM = (
    "你是开源情报采集员，负责建立证据台账。对每条来源用 Admiralty Code 两个维度独立评估："
    "来源可靠性 A=完全可靠 B=通常可靠 C=比较可靠 D=不太可靠 E=不可靠 F=无法判断；"
    "信息可信度 1=已由其他来源确认 2=很可能真实 3=可能真实 4=存疑 5=不可能 6=无法判断。"
    "你只能依据报告中转述的内容判定，不得假设你读过原文；必须在 note 里写清判定依据与不确定性。"
)

COLLECTOR_SCHEMA = """{
  "evidence": [
    {"url": "…", "publisher": "…", "reliability": "A-F", "credibility": "1-6",
     "supports": ["该来源支撑的结论（用结论原句的短标题）"], "note": "判定依据与不确定性"}
  ],
  "coverage_gaps": ["证据不足但结论已下判断的地方"],
  "single_source_claims": ["只有单一来源支撑的结论"]
}"""

REVIEWER_SYSTEM = (
    "你是情报审核员，负责在情报产品交付前做质检。你要找出：结论之间互相矛盾之处、"
    "被单薄证据支撑却写成定论的地方、以及最需要拿到反证才能站住的判断。"
    "只输出你能在给定报告里指出来的问题，不要泛泛而谈。"
)

REVIEWER_SCHEMA = """{
  "conflicts": [{"between": ["结论 A", "结论 B"], "why": "…", "suggestion": "…"}],
  "overstated": [{"claim": "…", "why": "证据强度不足", "suggestion": "降级为推断并说明不确定性"}],
  "needs_counter_evidence": ["最该去找反证的问题"],
  "review_verdict": "pass|revise",
  "review_notes": "给撰稿岗位的一句话整改意见"
}"""


def _signal_lines(signals: list[dict]) -> str:
    return "\n".join(
        f"- [{s.get('source')}|可信度{s.get('credibility')}/5|{s.get('category')}] {s.get('title')} — {s.get('url') or s.get('sourceUrl', '')}"
        for s in signals
    )


async def run_intelligence_roles(record: dict, model: str) -> dict:
    """对已完成的报告跑一轮情报岗位作业，返回结构化产物。"""
    report = record.get("report") or ""
    if not report:
        raise ValueError("该记录没有报告正文，无法做情报加工")

    task = record.get("task") or {}
    focus = record.get("focus") or task.get("focus") or (record.get("query") or "")[:60]
    signals = record.get("signals_detail") or []

    started = time.time()
    artifacts: dict = {
        "task_id": record.get("task_id"),
        "focus": focus,
        "model": model,
        "generated_at": time.time(),
        "roles": {},
    }

    # 岗位一：情报需求分析师（KIQ）
    kiq_prompt = [
        {"role": "system", "content": REQUIREMENTS_SYSTEM},
        {
            "role": "user",
            "content": (
                f"关注方向：{focus}\n"
                f"监测信号：\n{_signal_lines(signals) if signals else '（本次运行没有留存信号明细，请基于关注方向推断）'}\n\n"
                f"报告已规划的章节：{[s['heading'] for s in iter_sections(report, max_sections=8)]}\n\n"
                f"请输出 JSON（不要 markdown 代码块），格式：\n{REQUIREMENTS_SCHEMA}"
            ),
        },
    ]
    artifacts["roles"]["requirements_analyst"] = await call_model(kiq_prompt, model, response_format="json")

    # 岗位二：开源情报采集员（Admiralty 证据台账）
    sections = iter_sections(report)
    sources = extract_sources(report)
    collector_prompt = [
        {"role": "system", "content": COLLECTOR_SYSTEM},
        {
            "role": "user",
            "content": (
                f"报告章节（截断）：\n{json.dumps(sections, ensure_ascii=False)}\n\n"
                f"报告引用过的来源（共 {len(sources)} 条）：\n{json.dumps(sources[:40], ensure_ascii=False)}\n\n"
                f"请输出 JSON（不要 markdown 代码块），格式：\n{COLLECTOR_SCHEMA}"
            ),
        },
    ]
    artifacts["roles"]["osint_collector"] = await call_model(collector_prompt, model, response_format="json")

    # 岗位三：情报审核员（机械口径 + 一致性判断）
    stats = citation_stats(report)
    reviewer_prompt = [
        {"role": "system", "content": REVIEWER_SYSTEM},
        {
            "role": "user",
            "content": (
                f"报告章节（截断）：\n{json.dumps(sections, ensure_ascii=False)}\n\n"
                f"机械核查结果（引用可验证率）：\n{json.dumps({k: v for k, v in stats.items() if k != 'claims_without_citation'}, ensure_ascii=False)}\n"
                f"无引用段落示例：\n{json.dumps(stats['claims_without_citation'][:5], ensure_ascii=False)}\n\n"
                f"请输出 JSON（不要 markdown 代码块），格式：\n{REVIEWER_SCHEMA}"
            ),
        },
    ]
    artifacts["roles"]["quality_reviewer"] = await call_model(reviewer_prompt, model, response_format="json")
    artifacts["roles"]["quality_reviewer_mechanics"] = stats
    artifacts["elapsed_sec"] = round(time.time() - started, 1)
    return artifacts
