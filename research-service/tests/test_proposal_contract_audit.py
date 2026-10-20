from service.research_state import build_state, apply_research, apply_review, evidence_record
from service.evaluation import evaluate


def one_question(rows):
    return build_state("Atlas", "fact_check", rows, questions=[
        dict(id="fact", axis="identity", question="Atlas基础事实是什么？", task_type="fact_check")
    ])


def test_pending_findings_are_not_counted_as_verified_question_coverage():
    row = dict(url="https://example.org/atlas", title="Atlas release",
               content="Atlas v1 has 32 layers.", summary="Atlas release", published_at="2026-10-01")
    state = one_question([row])
    apply_research(state, "fact", dict(claims=[
        dict(text="Atlas has 32 layers.", conditions="v1", evidence_keys=[row["url"]])
    ]), [evidence_record(row)])
    assert evaluate(state)["key_question_coverage"]["value"] == 0
    apply_review(state, "fact", dict(checks=[dict(index=0, verdict="supported", reason="32 layers in source")]))
    assert evaluate(state)["key_question_coverage"]["value"] == 1


def test_body_changes_with_unchanged_metadata_invalidate_dependent_question():
    row = dict(url="https://example.org/atlas", title="Atlas release", summary="Same abstract",
               content="Unchanged introduction. " * 150 + "Hardware: 48GB.", published_at="2026-10-01")
    state = one_question([row])
    apply_research(state, "fact", dict(claims=[
        dict(text="Atlas needs 48GB.", conditions="v1", evidence_keys=[row["url"]])
    ]), [evidence_record(row)])
    apply_review(state, "fact", dict(checks=[dict(index=0, verdict="supported", reason="Source states 48GB")]))
    newer = dict(row, content=row["content"].replace("48GB", "16GB"))
    updated = build_state("Atlas", "fact_check", [newer], state)
    assert row["url"] in updated["delta"]["changed"]
    assert "fact" in updated["affected"]
    old_claim = updated["issues"]["fact"]["claims"][0]
    assert updated["evidence_versions"][row["url"]][old_claim["evidence_fingerprints"][row["url"]]]["content"].endswith("48GB.")


def test_obsolete_supported_fact_counts_even_when_badge_says_revised():
    row = dict(url="https://example.org/atlas", title="Atlas release", content="Atlas needs 48GB.")
    state = one_question([row])
    apply_research(state, "fact", dict(claims=[
        dict(text="Atlas needs 48GB.", conditions="v1", evidence_keys=[row["url"]])
    ]), [evidence_record(row)])
    apply_review(state, "fact", dict(checks=[dict(index=0, verdict="supported", reason="Old source")]))
    state["issues"]["fact"]["claims"][0]["update_status"] = "revised"
    state["evaluation_labels"] = dict(stale_claim_texts=["Atlas needs 48GB."])
    assert evaluate(state)["stale_retention"]["value"] == 1


def test_first_research_action_receives_newly_associated_sources():
    import asyncio
    from service.structured_workflow import run_structured
    from service.runner import EventBus
    row = dict(url="https://example.org/atlas", title="Atlas release", summary="Atlas version release")
    state = one_question([row])
    seen = []
    class Adapter:
        async def search_with_sources(self, query, sources):
            seen.append([s["key"] for s in sources])
            return [evidence_record(dict(row, content="Atlas has 32 layers."))]
        async def generate(self, role, payload):
            return dict(claims=[dict(text="Atlas has 32 layers.", conditions="v1", evidence_keys=[row["url"]])])
    asyncio.run(run_structured(dict(structured_state=state, action_budget=1,
                                   structured_task_id="981", query="Atlas"), EventBus(), Adapter()))
    assert seen[0] == [row["url"]]


def test_acquired_original_fingerprint_tracks_body_not_only_search_snippet(monkeypatch):
    import asyncio
    from service import safe_sources, search_gateway
    from service.structured_workflow import ResearchAdapter
    row = dict(url="https://example.org/atlas", title="Atlas release", summary="Same search snippet")
    count = 0
    async def search(*args):
        return []
    async def fetch(url):
        nonlocal count
        count += 1
        return dict(url=url, title="Atlas release", raw_content="Original hardware: " + ("48GB" if count == 1 else "16GB"))
    monkeypatch.setattr(search_gateway, "search", search)
    monkeypatch.setattr(safe_sources, "fetch_source", fetch)
    async def run():
        first = (await ResearchAdapter().search_with_sources("Atlas", [evidence_record(row)]))[0]
        second = (await ResearchAdapter().search_with_sources("Atlas", [evidence_record(row)]))[0]
        assert first["content"] != second["content"]
        assert first["fingerprint"] != second["fingerprint"]
    asyncio.run(run())
