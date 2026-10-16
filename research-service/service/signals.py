"""信号 → 研究任务 的桥接。

唯一数据来源：monitor-ai 的 data/signals-snapshot.json（由 src/lib/poller.ts 后台写入）。
本模块只做「挑信号 + 组课题」，不做任何 LLM 调用。
"""
from __future__ import annotations

import json
import math
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = SERVICE_ROOT.parent
DEFAULT_SNAPSHOT = REPO_ROOT / "data" / "signals-snapshot.json"

CATEGORY_LABELS = {
    "models": "模型与技术能力",
    "products": "产品与工程化",
    "industry": "产业与厂商动向",
    "papers": "学术前沿",
    "tips": "社区与经验",
}

# 技术情报的口径：可核验、区分事实与推断、给趋势与风险判断。
DEFAULT_GUIDELINES = [
    "报告必须使用中文撰写。",
    "每条结论后必须给出可核验的来源链接；无来源的结论必须删除或明确标注为推断。",
    "必须区分「事实」与「推断」：推断部分要写清依据和不确定性。",
    "必须给出趋势判断：技术路线、主要参与者、成熟度、潜在风险，以及对企业技术选型的含义。",
    "禁止把信号标题直接当成结论；结论必须回答「这意味着什么」。",
]


def load_signals(path: str | Path = DEFAULT_SNAPSHOT, locale: str = "zh"):
    """读快照，返回 (signals, fetchedAt)。locale 缺失时退回第一个可用语言块。"""
    if not Path(path).is_file():
        return [], None
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("snapshot must be an object")
    block = payload.get(locale) or next((b for b in payload.values() if isinstance(b, dict) and isinstance(b.get("signals"), list)), {})
    if not isinstance(block, dict) or not isinstance(block.get("signals", []), list):
        raise ValueError("snapshot signals must be an array")
    return [s for s in block.get("signals", []) if isinstance(s, dict)], block.get("fetchedAt")


def select_signals(
    signals: list[dict],
    *,
    categories: list[str] | None = None,
    min_credibility: int = 3,
    top: int = 12,
    exclude_providers: tuple[str, ...] = ("github",),
    max_per_provider: int = 4,
) -> list[dict]:
    """按可信度与来源过滤，再按 importance/sourcesCount/credibility 取头部信号。

    - GitHub Trending 默认剔除：快照里多为 awesome-list 与旧仓库，对技术趋势判断是噪声。
    - 单来源配额（max_per_provider）：不设限时 Hacker News 的 importance 会挤掉全部论文/
      产业信号，情报面过窄；配额保证"新闻 + 学术 + 产业"混合。
    """
    def number(value):
        try:
            parsed = float(value or 0)
            return parsed if math.isfinite(parsed) else 0.0
        except (ValueError, TypeError):
            return 0.0
    picked: list[dict] = []
    per_provider: dict[str, int] = {}
    for s in sorted(
        (
            s
            for s in signals
            if isinstance(s, dict) and number(s.get("credibility")) >= min_credibility
            and s.get("providerId") not in exclude_providers
            and (not categories or s.get("category") in categories)
        ),
        key=lambda s: (
            number(s.get("importance")),
            number(s.get("sourcesCount")),
            number(s.get("credibility")),
        ),
        reverse=True,
    ):
        provider = str(s.get("providerId") or s.get("source") or "unknown")[:200]
        if per_provider.get(provider, 0) >= max_per_provider:
            continue
        per_provider[provider] = per_provider.get(provider, 0) + 1
        picked.append(s)
        if len(picked) >= top:
            break
    return picked


def _signal_block(signals: list[dict]) -> str:
    return "\n".join(
        f"- [{s.get('source')}|可信度{s.get('credibility')}/5|{CATEGORY_LABELS.get(s.get('category'), s.get('category'))}] "
        f"{s.get('title')} — {s.get('sourceUrl', '')}"
        for s in signals
    )


def _base_task(query: str, *, model: str, max_sections: int, total_words: int, focus: str = "", guidelines=None) -> dict:
    """multi_agents 的任务配置。

    pdf/docx 关闭：Markdown 产出够用，且避开 Windows 上 weasyprint 的原生依赖。
    focus/signals_used 是上游不读的附加字段，仅用于本地报告库展示。
    """
    return {
        "query": query,
        "focus": focus,
        "signals_used": [],
        "signals_detail": [],
        "max_sections": max_sections,
        "max_plan_revisions": 1,
        "max_draft_revisions": 1,
        "max_fact_check_revisions": 1,
        "publish_formats": {"markdown": True, "pdf": False, "docx": False},
        "include_human_feedback": False,
        "follow_guidelines": True,
        "model": model,
        "guidelines": list(guidelines or DEFAULT_GUIDELINES),
        "verbose": False,
    }


def build_task_from_signals(
    signals: list[dict],
    *,
    focus: str,
    model: str,
    max_sections: int = 3,
    total_words: int = 1500,
    guidelines=None,
) -> dict:
    """把选中的信号拼成研究课题。

    检索后端只吃 `query`：整段信号清单会让 OpenAlex 返回 400（URL 过长）、arXiv 限流 429，
    证据基座直接变空。所以 query 只保留「方向 + 少量信号标题」用于选题与规划，
    信号清单与 URL 放进 guidelines，供规划/评审/写作阶段取证与要求引用。
    """
    if not signals:
        raise ValueError("没有可用信号：请检查 data/signals-snapshot.json 与过滤条件")

    headlines = "；".join(s.get("title", "") for s in signals[:4] if s.get("title"))
    query = (
        f"面向企业技术选型的技术情报分析：{focus}。"
        f"近期监测到的相关信号包括：{headlines}。"
        "请判断技术趋势、主要参与者动向、成熟度与风险。"
    )

    signal_notes = (
        "以下信号来自 monitor-ai 的监测快照，用于确定分析方向与取证线索（不是必须逐条检索的 URL 清单）：\n"
        f"{_signal_block(signals)}"
    )
    task_guidelines = list(guidelines or DEFAULT_GUIDELINES) + [signal_notes]
    task = _base_task(
        query,
        model=model,
        max_sections=max_sections,
        total_words=total_words,
        focus=focus,
        guidelines=task_guidelines,
    )
    # 情报岗位作业（roles.py）要按信号明细开展工作，所以把明细一起带着
    task["signals_detail"] = [
        {
            "id": s.get("id"),
            "title": s.get("title"),
            "source": s.get("source"),
            "url": s.get("sourceUrl"),
            "credibility": s.get("credibility"),
            "category": s.get("category"),
            "publishedAt": s.get("publishedAt"),
        }
        for s in signals
    ]
    task["signals_used"] = [s.get("id") for s in signals]
    return task


def build_task_from_query(
    query: str, *, model: str, max_sections: int = 3, total_words: int = 1500, guidelines=None
) -> dict:
    """不依赖信号，直接给一个研究问题（调试与对照实验用）。"""
    return _base_task(
        query,
        model=model,
        max_sections=max_sections,
        total_words=total_words,
        focus=query[:60],
        guidelines=guidelines,
    )
