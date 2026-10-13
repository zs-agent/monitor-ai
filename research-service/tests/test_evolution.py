from service.evolution import prepare_research, signal_delta
import pytest

def signal(title="v1", url="https://example.org/model", **kwargs):
    return dict(title=title, sourceUrl=url, credibility=4, category="models", **kwargs)

def task(query="事实核查"):
    return dict(query=query, guidelines=[], max_draft_revisions=1, max_fact_check_revisions=1)

def test_reposts_are_not_independent_evidence():
    delta = signal_delta([signal(), signal(url="https://example.org/model/?utm_source=x#section")], [])
    assert delta["current_count"] == 1

def test_update_is_separate_from_absence():
    delta = signal_delta([signal("v2")], [signal(), signal(url="https://example.org/old")])
    assert delta["changed"][0]["fields"] == ["title"]
    assert delta["not_in_current_snapshot"] == ["https://example.org/old"]
    assert not delta["added"]

def test_fixed_baseline_and_adaptive_review_budget():
    inputs = [signal(url=f"https://example.org/{i}") for i in range(3)]
    assert prepare_research(task("安全风险"), inputs)["max_fact_check_revisions"] == 2
    assert prepare_research(task("安全风险"), inputs, mode="fixed")["max_fact_check_revisions"] == 1
    assert prepare_research(task(), inputs)["max_fact_check_revisions"] == 1

def test_history_has_bounded_context_and_lineage():
    parent = dict(task_id=123, status="done", report="x" * 10000, signals_detail=[signal()])
    result = prepare_research(task(), [signal("v2")], parent)
    assert result["research_policy"]["parent_task_id"] == 123
    assert "x" * 6001 not in result["guidelines"][-1]
    assert "不得因快照缺失" in result["guidelines"][-1]

def test_incomplete_history_rejected():
    with pytest.raises(ValueError):
        prepare_research(task(), [], dict(status="error", report="partial"))

def test_deterministic_and_no_input_mutation():
    original = task("对象比较")
    signals = [signal("b"), signal("a", "https://example.org/other")]
    a = prepare_research(original, signals)
    b = prepare_research(original, list(reversed(signals)))
    assert a == b
    assert original["guidelines"] == []
