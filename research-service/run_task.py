"""按 monitor-ai 的信号跑一次多智能体技术情报研究（不需要启动 HTTP 服务）。

用法（在 research-service 目录下）：
  .venv/Scripts/python.exe run_task.py --signals-only                 # 只看挑出来的信号
  .venv/Scripts/python.exe run_task.py --focus "AI 智能体编排框架" --top 10
  .venv/Scripts/python.exe run_task.py --query "固态电池产业化进展"    # 不依赖信号，调试/对照组用
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(SERVICE_ROOT))

from service import signals as sig  # noqa: E402
from service.runner import EventBus, default_model, run_task, save_run  # noqa: E402


def _parse_categories(raw: str | None) -> list[str] | None:
    if not raw:
        return None
    return [c.strip() for c in raw.split(",") if c.strip()]


async def _run(args) -> int:
    model = default_model()
    categories = _parse_categories(args.categories)

    if args.query:
        task = sig.build_task_from_query(
            args.query, model=model, max_sections=args.max_sections, total_words=args.total_words
        )
        chosen: list[dict] = []
    else:
        all_signals, fetched_at = sig.load_signals(args.snapshot)
        chosen = sig.select_signals(all_signals, categories=categories, top=args.top)
        task = sig.build_task_from_signals(
            chosen, focus=args.focus, model=model, max_sections=args.max_sections, total_words=args.total_words
        )
        if not args.json:
            import datetime as _dt

            stamp = _dt.datetime.fromtimestamp((fetched_at or 0) / 1000).strftime("%Y-%m-%d %H:%M")
            print(f"# 信号快照时间 {stamp}，选中 {len(chosen)}/{len(all_signals)} 条（model={model}）")
            for s in chosen:
                print(f"  · [{s.get('credibility')}/5] {s.get('title')}  <{s.get('source')}>")

    if args.signals_only:
        return 0

    bus = EventBus()
    queue = bus.subscribe()

    async def printer() -> None:
        while True:
            ev = await queue.get()
            line = f"[{ev.get('event') or ev.get('type')}] {ev.get('output', '')}"
            print(line[:400], flush=True)

    printer_task = asyncio.create_task(printer())
    try:
        result = await run_task(task, bus=bus)
    finally:
        printer_task.cancel()

    # 落盘（runs/<task_id>.json 保存上游原文；runs/<task_id>.md 用展示层规范化后的标题）
    record_path = save_run(
        task,
        result,
        bus.events,
        status="done" if result.get("report") else "error",
        error=None if result.get("report") else "运行结束但没有产出报告（检查模型 key 与检索器可达性）",
    )
    if record_path:
        result["record_path"] = str(record_path)

    payload = {
        k: v for k, v in result.items() if k != "report"
    } | {"report_preview": (result.get("report") or "")[:400]}
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if result.get("report") else 1


def main() -> int:
    ap = argparse.ArgumentParser(description="信号驱动的多智能体技术情报研究")
    ap.add_argument("--focus", default="AI 领域近期技术动向")
    ap.add_argument("--query", default=None, help="直接给研究问题（跳过信号）")
    ap.add_argument("--categories", default=None, help="逗号分隔：models,products,industry,papers,tips")
    ap.add_argument("--top", type=int, default=10, help="最多挑多少条信号")
    ap.add_argument("--max-sections", type=int, default=3)
    ap.add_argument("--total-words", type=int, default=1500)
    ap.add_argument("--snapshot", default=str(sig.DEFAULT_SNAPSHOT))
    ap.add_argument("--signals-only", action="store_true", help="只打印选中的信号，不调用模型")
    ap.add_argument("--json", action="store_true", help="静默协作日志，只输出最终 JSON")
    args = ap.parse_args()

    if args.json:
        import contextlib
        import io

        with contextlib.redirect_stdout(io.StringIO()):
            return asyncio.run(_run(args))
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
