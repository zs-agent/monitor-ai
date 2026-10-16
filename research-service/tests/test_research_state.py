import asyncio
from copy import deepcopy
from itertools import product

import pytest
from service.research_state import build_state, allocate, action_options, apply_research, apply_review, evidence_record, infer_type
from service.structured_workflow import run_structured


def signal(title="Atlas model benchmark v1", url="https://example.org/model"):
    return dict(title=title, sourceUrl=url, publishedAt="2026-10-01", summary="Atlas model capability")


def reviewed_state():
    state = build_state("Atlas", "comparison", [signal()])
    for key in state["issues"]:
        e = evidence_record(signal())
        apply_research(state, key, {"claims": [{"text": "historic finding", "conditions": "v1, same controlled test", "comparison": dict(dimension='capability', conditions='same controlled test', comparable=True), "source_urls": [e["url"]]}]}, [e])
        apply_review(state, key, {"checks": [{"index": 0, "verdict": "supported"}]})
    return state


def test_task_type_taxonomy():
    assert [infer_type(q) for q in ("发布事实", "对象比较", "近期动态", "应用风险")] == ["fact_check", "object_comparison", "dynamic_analysis", "risk_assessment"]


def test_unchanged_analysis_is_carried_without_mutating_parent():
    parent = reviewed_state()
    before = deepcopy(parent)
    state = build_state("Atlas", "comparison", [signal()], parent)
    assert not state["affected"]
    assert all(i["status"] == "carried" for i in state["issues"].values())
    assert parent == before


def test_added_signal_targets_related_axis():
    parent = reviewed_state()
    # clear broad source dependency on unrelated units for realistic selective linkage
    for issue in parent["issues"].values():
        if issue["axis"] != "capability":
            issue["signal_keys"] = []
    new_signal = signal("Atlas deploy cost v2", "https://example.org/deploy")
    new_signal['summary'] = 'Atlas deployment cost'
    state = build_state("Atlas", "comparison", [signal(), new_signal], parent)
    axes = {state["issues"][i]["axis"] for i in state["affected"]}
    assert axes == {"deployment"}


def test_absence_triggers_recheck_without_deleting_claims():
    parent = reviewed_state()
    state = build_state("Atlas", "comparison", [], parent)
    assert state["delta"]["absent_from_snapshot"]
    assert len(state["affected"]) == 3
    assert all(i["claims"] for i in state["issues"].values())
    assert all(c['status'] == 'pending_verification' for i in state['issues'].values() for c in i['claims'])


def test_scope_mismatch_rejected_and_time_change_rechecks():
    parent = reviewed_state()
    with pytest.raises(ValueError):
        build_state("Other", "comparison", [], parent)
    assert len(build_state("Atlas", "comparison", [signal()], parent, "2026-10")['affected']) == 3


def test_knapsack_matches_brute_force_and_can_skip():
    options = {"a": [{"cost": 2, "utility": 8}, {"cost": 3, "utility": 9}],
               "b": [{"cost": 2, "utility": 8}], "c": [{"cost": 1, "utility": 2}]}
    for budget in range(7):
        optimum = max(sum(i["utility"] for i in choice) for choice in product(*[[{"cost":0,"utility":0}] + v for v in options.values()]) if sum(i["cost"] for i in choice) <= budget)
        allocation = allocate(options, budget)
        assert allocation["proxy_utility"] == optimum
        assert allocation["reserved_units"] <= budget
    assert allocate(options, 0)["selected"] == []


def test_unknown_citations_and_missing_review_never_pass():
    state = build_state("Atlas", "fact", [signal()])
    key = next(iter(state["issues"]))
    apply_research(state, key, {"claims":[{"text":"unknown","source_urls":["https://fake.org"]}]}, [evidence_record(signal())])
    apply_review(state,key,{"checks":[{"index":0,"verdict":"supported"}]})
    assert state["issues"][key]["status"] == "unresolved"


class Bus:
    def __init__(self): self.events = []
    def publish(self, event): self.events.append(event)


class FakeAdapter:
    def __init__(self, fail=False): self.calls = []; self.fail = fail
    async def search(self, query):
        self.calls.append(('search',query))
        if self.fail: raise RuntimeError('offline')
        return [evidence_record(signal())]
    async def generate(self, role, payload):
        self.calls.append((role,payload))
        return {"claims":[{"text":"test finding", "conditions": "v1 controlled test", "comparison": dict(dimension='capability', conditions='same test', comparable=True), "source_urls":["https://example.org/model"]}]} if role == "research" else {"checks":[{"index":0,"verdict":"supported"}]}


def task(state,budget=4):
    return dict(structured_state=state,action_budget=budget,structured_task_id=123,query='Atlas',scheduler_mode='adaptive')


def test_owned_graph_bounds_actions_and_persists_units():
    state = build_state('Atlas','fact',[signal()])
    adapter = FakeAdapter()
    result = asyncio.run(run_structured(task(state),Bus(),adapter))
    assert result['execution_status'] == 'completed'
    assert result['structured_state']['allocation']['spent_units'] == 4
    assert len(adapter.calls) == 8
    assert all(i['revision'] == 1 for i in result['structured_state']['issues'].values())


def test_failure_charged_and_stable_units_not_executed():
    adapter = FakeAdapter(fail=True)
    result = asyncio.run(run_structured(task(build_state('Atlas','fact',[signal()]),1),Bus(),adapter))
    assert result['execution_status'] == 'failed'
    assert result['structured_state']['allocation']['spent_units'] == 1
    parent = reviewed_state()
    state = build_state('Atlas','comparison',[signal()],parent)
    adapter = FakeAdapter()
    result = asyncio.run(run_structured(task(state),Bus(),adapter))
    assert not adapter.calls
    assert result['structured_state']['allocation']['spent_units'] == 0
