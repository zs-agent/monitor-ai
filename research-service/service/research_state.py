"""Explicit issue/evidence state and deterministic budgeted action allocation.

Similarity and utility are inspectable proxies, not factual truth or learned gains.
The standard multiple-choice knapsack solver is reused as an optimization primitive.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
import re
import time
import math
from datetime import datetime

from .evolution import canonical_url
from .contracts import SchedulerConfig, ConclusionPayload, StructuredConclusion, ReviewCheck, TaskType
from pydantic import ValidationError

TASK_TYPES = tuple(kind.value for kind in TaskType)
TYPE_ALIASES = dict(zip(("fact", "comparison", "temporal", "risk"), TASK_TYPES))
def normalize_type(value):
    return TYPE_ALIASES.get(value, value) if isinstance(value, str) else value
TYPE_LABELS = dict(zip(TASK_TYPES, ("事实核查", "对象比较", "动态分析", "风险研判")))
AXES = {
    "fact_check": [("capability", "对象版本、发布与能力事实"), ("deployment", "部署条件与工程事实")],
    "object_comparison": [("capability", "共同能力维度"), ("deployment", "部署要求与成本"), ("ecosystem", "生态与维护情况")],
    "dynamic_analysis": [("capability", "版本与能力演进"), ("deployment", "部署与运行条件变化"), ("ecosystem", "生态与参与者动态")],
    "risk_assessment": [("deployment", "工程与部署限制"), ("risk", "风险依据、反例与适用边界")],
}
AXIS_WORDS = {
    "identity": ("release", "version", "发布", "版本"),
    "capability": ("release", "version", "发布", "版本", "model", "benchmark", "paper", "能力", "模型", "论文", "性能"),
    "deployment": ("cost", "deploy", "hardware", "quant", "gpu", "成本", "部署", "推理", "显存", "量化"),
    "ecosystem": ("repo", "framework", "生态", "框架", "维护", "开源", "仓库"),
    "risk": ("risk", "security", "风险", "安全", "限制"),
}


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def tokens(text):
    from .search_queries import normalize_query
    text = normalize_query(str(text))
    words = set(re.findall(r"[a-z0-9][a-z0-9_.-]*", str(text).lower()))
    for part in re.findall(r"[\u4e00-\u9fff]+", str(text)):
        words.update(part[i:i + 2] for i in range(len(part) - 1))
    return words


def similarity(a, b):
    x, y = tokens(a), tokens(b)
    return len(x & y) / max(1, len(x | y))


def infer_type(query):
    for kind, terms in (("risk_assessment", ("风险", "安全", "risk")),
                        ("object_comparison", ("比较", "对比", "选型", "compare")),
                        ("dynamic_analysis", ("动态", "趋势", "近期", "变化", "trend"))):
        if any(t in str(query).lower() for t in terms):
            return kind
    return "fact_check"


def evidence_record(item):
    url = canonical_url(item.get("sourceUrl") or item.get("url") or item.get("href"))
    title = str(item.get("title") or "")[:500]
    content = str(item.get("raw_content") or item.get("content") or item.get("body") or item.get("summary") or "")
    key = url or "id:" + str(item.get("id") or digest([title, content[:12000]])[:16])[:200]
    fields = {"title": title, "content": content[:12000], "summary": str(item.get("summary") or content[:2000])[:2000], "published_at": str(item.get("publishedAt") or item.get("published_at") or item.get("date") or "")[:100],
              "source": str(item.get("source") or item.get("providerId") or "")[:200], "url": url}
    fetched_at = item.get('fetched_at')
    if type(fetched_at) not in (int, float) or not math.isfinite(fetched_at) or fetched_at <= 0:
        fetched_at = time.time()
    return dict(key=key, fingerprint=digest({k: fields[k] for k in ("title", "summary", "published_at")}), fetched_at=fetched_at, **fields)


def linked(issue, evidence, focus):
    text = evidence["title"] + " " + evidence["content"]
    score = similarity(focus, text)
    focused = score >= 0.04 or focus.lower() in text.lower()
    axis = any(w in text.lower() for w in AXIS_WORDS[issue["axis"]])
    return focused and axis


def build_state(focus, task_type, signals, parent=None, time_scope="", association_mode="structured",
                scheduler_config=None, questions=None, manual_associations=None, semantic_scores=None):
    if association_mode not in ("structured", "unfiltered", "keyword", "semantic"):
        raise ValueError("invalid association mode")
    config = SchedulerConfig.model_validate(scheduler_config or {}).model_dump()
    if association_mode == "semantic" and semantic_scores is None:
        raise ValueError("语义关联需要配置向量服务，不能以词项分数代替语义相似度")
    task_type = normalize_type(task_type)
    if parent:
        parent = deepcopy(parent)
        parent["task_type"] = normalize_type(parent.get("task_type"))
    if task_type not in TASK_TYPES:
        raise ValueError("invalid task type")
    if parent and (parent.get("focus") != focus or parent.get("task_type") != task_type):
        raise ValueError("continuous research requires the same focus and task type")
    if parent and parent.get("schema_version") != "issue-state-v1":
        raise ValueError("unsupported parent state")
    if parent:
        refresh_dependencies(parent)
    current = {}
    cleaning = []
    seen_content = {}
    conflicts = set()
    snapshot_versions = deepcopy((parent or {}).get("evidence_versions") or {})
    for item in signals:
        if not isinstance(item, dict):
            cleaning.append(dict(reason="invalid_record"))
            continue
        e = evidence_record(item)
        snapshot_versions.setdefault(e["key"], {})[e["fingerprint"]] = deepcopy(e)
        reason = "duplicate_url" if e["key"] in current else "duplicate_content" if e["fingerprint"] in seen_content else "accepted"
        if e["key"] in current and e["fingerprint"] != current[e["key"]]["fingerprint"]:
            reason = "conflicting_version"
            conflicts.add(e["key"])
        cleaning.append(dict(key=e["key"], title=e["title"], original_url=item.get("sourceUrl") or item.get("url"), normalized_url=e["url"], reason=reason))
        # Keep independent source identities for dependency diff; reposts are excluded from association only.
        e["duplicate_of"] = seen_content.get(e["fingerprint"])
        if e["key"] not in current:
            current[e["key"]] = e
            seen_content.setdefault(e["fingerprint"], e["key"])
    previous = (parent or {}).get("signal_evidence", {})
    added = sorted(current.keys() - previous.keys())
    changed = sorted(k for k in current.keys() & previous.keys() if current[k]["fingerprint"] != previous[k]["fingerprint"])
    changed = sorted(set(changed) | (conflicts & previous.keys()))
    missing = sorted(previous.keys() - current.keys())
    issues = deepcopy((parent or {}).get("issues") or {})
    specs = questions or ([dict(id=q['id'], axis=q['axis'], question=q['question'], task_type=q.get('task_type', task_type)) for q in issues.values()] if issues else
        [dict(id=digest([focus, task_type, axis])[:16], axis=axis, question=f"{focus}：{label}？", task_type=task_type) for axis, label in AXES[task_type]])
    changed_questions = set()
    seen_questions = set()
    for spec in specs:
        axis, label = spec["axis"], spec["question"]
        issue_id = spec.get('id') or next((k for k, q in issues.items() if q['axis'] == axis and q['question'] == label), digest([focus, task_type, axis, label])[:16])
        if issue_id in seen_questions:
            raise ValueError('问题标识必须唯一')
        seen_questions.add(issue_id)
        if issue_id not in issues:
            issues[issue_id] = dict(id=issue_id, axis=axis, question=label, task_type=spec["task_type"],
                                    claims=[], evidence_keys=[], status="pending", revision=0)
        elif any(issues[issue_id].get(k) != spec.get(k) for k in ('axis', 'question', 'task_type')):
            issues[issue_id].update(axis=axis, question=label, task_type=spec['task_type'])
            changed_questions.add(issue_id)
    corrections = {item["evidence_key"]: item for item in (manual_associations or [])}
    if any(key not in current for key in corrections):
        raise ValueError("人工关联来源必须存在于当前快照")
    for item in corrections.values():
        if (item["object_name"] != focus and item['question_ids']) or any(key not in issues for key in item["question_ids"]):
            raise ValueError("人工关联的对象或问题不属于当前任务")
    associations = []
    for e in current.values():
        score = similarity(focus, e["title"] + " " + e["content"])
        content = e["title"] + " " + e["content"]
        matched_terms = sorted(tokens(focus) & tokens(content))
        if association_mode == "semantic":
            score = float(semantic_scores.get(e["key"], 0))
            if not math.isfinite(score) or not -1 <= score <= 1:
                raise ValueError("invalid semantic similarity")
        threshold = 0.35 if association_mode == "semantic" else 0.04
        focused = score >= threshold or (association_mode != "semantic" and focus.lower() in content.lower())
        dimensions = {k: [w for w in AXIS_WORDS[q["axis"]] if w in content.lower()] for k, q in issues.items()}
        matched_ids = [k for k in issues if not e.get("duplicate_of") and (association_mode == "unfiltered" or
                       (bool(matched_terms) if association_mode == "keyword" else focused and bool(dimensions[k])))]
        correction = corrections.get(e["key"])
        if correction:
            if e.get("duplicate_of") and correction["question_ids"]:
                raise ValueError("重复转载不能作为独立证据，请校正原始来源")
            matched_ids = correction["question_ids"]
        associations.append(dict(key=e["key"], title=e["title"], fingerprint=e["fingerprint"], duplicate_of=e.get("duplicate_of"),
             score=score, threshold=threshold, matched_terms=matched_terms, dimension_hits=dimensions,
             question_ids=matched_ids, manual=correction, reason="manual_correction" if correction else "duplicate_content" if e.get("duplicate_of") else "matched" if matched_ids else "low_similarity" if not focused else "dimension_unmatched"))
    affected = set()
    reasons = {}
    for key, issue in issues.items():
        previous_signal_keys = set(issue.get("signal_keys", []))
        matched = [a["key"] for a in associations if key in a["question_ids"]]
        issue["signal_keys"] = sorted(matched)
        why = []
        if key in changed_questions:
            why.append('question_definition_changed')
        if parent and set(matched) != previous_signal_keys:
            why.append('association_mapping_changed')
        if not parent or not issue.get("claims"):
            why.append("no_previous_analysis")
        if parent and parent.get("time_scope", "") != time_scope:
            why.append("time_scope_changed")
        if parent and parent.get("association_mode", "structured") != association_mode:
            why.append("association_policy_changed")
        if set(issue.get("signal_keys", [])) & set(added + changed):
            why.append("related_signal_changed")
        if (set(issue.get("evidence_keys", [])) | previous_signal_keys) & set(changed + missing):
            why.append("dependency_requires_recheck")
        if parent and issue.get("status") not in ("reviewed", "carried"):
            why.append("previously_unresolved")
        if parent and any(domain_errors(c, issue.get('task_type', task_type), current) or c.get('status') != 'supported' for c in issue.get('claims', [])):
            why.append('historical_contract_requires_recheck')
        if why:
            affected.add(key)
            reasons[key] = why
            issue["status"] = "pending"
            issue['prior_claims'] = deepcopy(issue['claims'])
            for claim in issue["claims"]:
                claim["previous_status"] = claim["status"]
                claim["status"] = "pending_verification"
                claim['verification_status'] = 'pending_verification'
                claim['update_status'] = 'pending'
        else:
            issue["status"] = "carried"
            for claim in issue["claims"]:
                claim["update_status"] = "retained"
        issue["task_type"] = normalize_type(issue.get("task_type") or task_type)
    state = dict(schema_version="issue-state-v1", focus=focus, task_type=task_type,
                 contract_version='proposal-v2-20261015',
                 association_mode=association_mode, scheduler_config=config,
                 time_scope=time_scope, signal_evidence=current,
                 evidence=deepcopy((parent or {}).get("evidence") or {}), issues=issues,
                 evidence_versions=snapshot_versions,
                 delta=dict(added=added, changed=changed, stable=sorted(current.keys() & previous.keys() - set(changed)), absent_from_snapshot=missing),
                 association=dict(cleaning=cleaning, matches=associations, conflicting_versions=sorted(conflicts), unmatched=[a for a in associations if not a["question_ids"]], raw_count=len(signals), unique_count=len(current)),
                 affected=sorted(affected), impact_reasons=reasons, actions=[],
                 parent_digest=digest(parent) if parent else None)
    state["evidence"].update(current)
    refresh_dependencies(state)
    return state


def action_options(state, mode="adaptive", config=None):
    if mode not in ("adaptive", "fixed", "full", "single"):
        raise ValueError("invalid scheduler mode")
    if mode == "full":
        # Preview and execution must use the same target states and utilities.
        state['affected'] = sorted(state['issues'])
        for key, issue in state['issues'].items():
            reasons = state['impact_reasons'].setdefault(key, [])
            if 'full_recheck_policy' not in reasons:
                reasons.append('full_recheck_policy')
            issue['status'] = 'pending'
            for claim in issue['claims']:
                if claim['status'] != 'pending_verification':
                    claim['previous_status'] = claim['status']
                claim.update(status='pending_verification', verification_status='pending_verification', update_status='pending')
    result = {}
    cfg = SchedulerConfig.model_validate(config or state.get("scheduler_config") or {}).model_dump()
    state["scheduler_config"] = cfg
    ablations = cfg["ablations"]
    targets = sorted(state["issues"]) if mode == "full" else state["affected"]
    for key in sorted(state["issues"]):
        issue = state["issues"][key]
        independent = {state['evidence'][k]['fingerprint'] for k in issue.get('evidence_keys', []) if state['evidence'].get(k, {}).get('content')}
        coverage = min(1, len(independent) / 3)
        novelty = bool(set(issue.get("signal_keys", [])) & set(state["delta"]["added"] + state["delta"]["changed"]))
        uncertainty = not issue.get("claims") or issue.get("status") == "pending"
        contributions = dict(w0=cfg['w0'], n=0 if 'drop_n' in ablations else cfg['wn'] * int(novelty),
                             u=0 if 'drop_u' in ablations else cfg['wu'] * int(uncertainty),
                             c=0 if 'drop_c' in ablations else cfg['wc'] * int(coverage < 1))
        priority = sum(contributions.values())
        equal = mode == "fixed" or "equal_utility" in ablations
        utility_priority = 1 if equal else priority
        kind = issue.get('task_type', state['task_type'])
        risk_bonus = 0 if equal or 'drop_t' in ablations else cfg['beta_risk'] * int(kind == 'risk_assessment')
        issue["features"] = dict(t=kind, n=int(novelty), u=int(uncertainty), c=coverage, priority=priority, contributions=contributions)
        if key not in targets:
            continue
        # Each research/review action = one retrieval batch + one model generation.
        result[key] = [dict(issue_id=key, kind="defer", cost=0, utility=0), dict(issue_id=key, kind="research", cost=1, utility=utility_priority * cfg['alpha']),
                       dict(issue_id=key, kind="research_and_verify", cost=2, utility=utility_priority * cfg['alpha'] + cfg['beta_verify'] + risk_bonus)]
    if mode == "single":
        result = {k: [o for o in v if o["kind"] != "research_and_verify"] for k, v in result.items()}
    return result


def allocate(options, budget):
    """Exact multiple-choice knapsack: at most one bundle per issue.

    O(number_of_issues * budget * alternatives), stable tie-breaking.
    Empty choice is explicit; no zero-cost claims of a completed review.
    """
    if type(budget) is not int or budget < 0 or budget > 64:
        raise ValueError("budget must be an integer in [0, 64]")
    if not isinstance(options, dict) or any(not isinstance(k, str) for k in options):
        raise ValueError("options must map string question ids to candidate arrays")
    dp = {0: 0}
    traces = []
    for key in options:
        if not isinstance(options[key], list):
            raise ValueError("candidate packages must be an array")
        nxt = dict(dp)
        trace = {spent: (spent, None) for spent in dp}
        for option in options[key]:
            if not isinstance(option, dict) or type(option.get("cost")) is not int or type(option.get("utility")) not in (int, float) or not math.isfinite(option['utility']):
                raise ValueError("cost must be integer and utility must be finite")
            if option.get("kind") == "defer" and option["cost"] == 0 and option["utility"] == 0:
                continue
            if option["cost"] <= 0 or option["utility"] < 0:
                raise ValueError("invalid option")
            for spent, score in dp.items():
                cost = spent + option["cost"]
                value = score + option["utility"]
                if cost <= budget and (cost not in nxt or value > nxt[cost]):
                    nxt[cost] = value
                    trace[cost] = (spent, dict(option, issue_id=key))
        dp = nxt
        traces.append(trace)
    cost = max(dp, key=lambda c: (dp[c], -c))
    selected = []
    cursor = cost
    for trace in reversed(traces):
        cursor, option = trace[cursor]
        if option is not None:
            selected.append(option)
    selected.reverse()
    selected_ids = {o["issue_id"] for o in selected}
    # Backpointers avoid copying O(N)-length paths inside each DP transition.
    return dict(selected=selected, reserved_units=cost, proxy_utility=dp[cost], budget_units=budget,
                solver="multiple-choice-knapsack", utility_is_proxy=True, candidates=options,
                deferred=[key for key in options if key not in selected_ids])



def apply_research(state, issue_id, result, evidence):
    issue = state["issues"][issue_id]
    records = {e["key"]: e for e in evidence}
    claims = []
    raw_claims = result.get("claims", [])
    if not isinstance(raw_claims, list):
        raise ValueError("claims must be an array")
    issue['rejected_outputs'] = []
    for raw in raw_claims[:12]:
        if isinstance(raw, dict):
            raw = dict(raw)
            if isinstance(raw.get('kind'), str):
                raw['kind'] = {'fact': 'fact_statement', 'fact_check': 'fact_statement', 'inference': 'trend_inference'}.get(raw['kind'], raw['kind'])
        try:
            raw = ConclusionPayload.model_validate(raw).model_dump()
        except ValidationError as exc:
            issue['rejected_outputs'].append(dict(reason='模型结论结构不符合契约', fields=[str(e['loc']) for e in exc.errors(include_input=False)]))
            continue
        raw = sanitize_metadata(raw, records)
        urls = raw.get("evidence_keys", raw.get("source_urls", []))
        if not isinstance(urls, list):
            urls = []
        requested = {u if u in records else canonical_url(u) or u for u in urls if isinstance(u, str)} - {""}
        keys = sorted(k for k in requested & records.keys() if records[k].get("content"))
        if not raw["text"].strip():
            continue
        claim = dict(id=digest([issue_id, raw["text"]])[:16], text=sanitize_claim(raw["text"][:2000], records), evidence_keys=keys,
                           evidence_fingerprints={k: records[k]["fingerprint"] for k in keys},
                           rejected_sources=sorted(requested - set(keys)), uncertainty=str(raw.get("uncertainty") or "尚需核查")[:1000], update_label="revised" if issue["revision"] else "new",
                           kind={"fact": "fact_statement", "fact_check": "fact_statement", "inference": "trend_inference"}.get(raw.get("kind"), raw.get("kind", "fact_statement")),
                           source_times={k: records[k].get('published_at') or '未披露' for k in keys},
                           conditions=str(raw.get('conditions') or ''), comparison=raw.get('comparison'), versions=raw.get('versions'),
                           counter_evidence=raw.get('counter_evidence'),
                           verification_status="pending_verification", update_status="pending",
                           status="pending_verification")
        claim['contract_errors'] = domain_errors(claim, issue.get('task_type', state['task_type']), records)
        if claim['rejected_sources']:
            claim['contract_errors'].append('存在未实际取得的引用来源')
        StructuredConclusion.model_validate(claim)
        claims.append(claim)
    issue["history"] = (issue.get("history", []) + [dict(revision=issue["revision"], claims=deepcopy(issue.pop('prior_claims', issue['claims'])))])[-6:]
    issue.update(claims=claims, evidence_keys=sorted({k for c in claims for k in c["evidence_keys"]}),
                 revision=issue["revision"] + 1, status="draft" if claims else "unresolved")
    state["evidence"].update(records)
    refresh_dependencies(state)


def apply_review(state, issue_id, result):
    issue = state["issues"][issue_id]
    checks = result.get("checks", [])
    if not isinstance(checks, list):
        raise ValueError("checks must be an array")
    valid = {}
    for item in checks[:12]:
        try:
            item = ReviewCheck.model_validate(item).model_dump()
        except ValidationError:
            continue
        if item['index'] in valid:
            valid[item['index']] = dict(index=item['index'], verdict='insufficient', reason='同一结论存在重复审核判定，须重新核查')
        else:
            valid[item["index"]] = item
    for i, claim in enumerate(issue["claims"]):
        check = valid.get(i, {})
        claim["review"] = dict(check, reason=sanitize_claim(str(check.get("reason") or "审核未返回该结论的有效说明")[:2000], state["evidence"]))
        # Revalidate the exact acquired evidence/version, even if a caller or an
        # old stored record bypassed apply_research. A model cannot waive this.
        citation_errors = [k for k in claim['evidence_keys'] if not state['evidence'].get(k, {}).get('content')]
        errors = list(claim.get('contract_errors') or []) + domain_errors(claim, issue.get('task_type', state['task_type']), state['evidence'])
        if citation_errors or not claim['evidence_keys']:
            errors.append('来源键未通过实际资料集校验')
        claim['contract_errors'] = sorted(set(errors))
        verdict = check.get('verdict', 'insufficient')
        if errors and verdict == 'supported':
            verdict = 'insufficient'
        claim['verification_status'] = verdict
        claim["status"] = verdict
        claim['update_status'] = 'revised' if verdict == 'supported' else 'pending'
    refresh_dependencies(state)
    issue["status"] = "reviewed" if issue["claims"] and all(c["status"] == "supported" for c in issue["claims"]) else "unresolved"


def domain_errors(claim, task_type, records):
    errors = []
    if claim.get('kind') not in ('fact_statement', 'comparison_judgment', 'trend_inference'):
        errors.append('结论类型不符合契约')
    if not claim.get('conditions'):
        errors.append('缺少版本或适用条件说明')
    if task_type == 'object_comparison':
        comparison = claim.get('comparison')
        if not isinstance(comparison, dict) or not comparison.get('dimension') or not comparison.get('conditions') or type(comparison.get('comparable')) is not bool:
            errors.append('缺少共同比较维度、测试条件或可比性判断')
        elif not comparison['comparable'] and not comparison.get('mismatch_reason'):
            errors.append('测试条件不一致时须解释不可比原因')
    if task_type == 'dynamic_analysis':
        versions = claim.get('versions')
        if not isinstance(versions, dict) or not all(isinstance(versions.get(k), str) and versions[k].strip() for k in ('before', 'after', 'before_time', 'after_time')):
            errors.append('缺少前后版本号与时间')
        else:
            try:
                before = datetime.fromisoformat(versions['before_time'].replace('Z', '+00:00'))
                after = datetime.fromisoformat(versions['after_time'].replace('Z', '+00:00'))
                if (before.tzinfo is None) != (after.tzinfo is None) or before > after:
                    errors.append('版本时间顺序或时区不一致')
            except ValueError:
                errors.append('版本时间须采用ISO日期时间格式')
    if task_type == 'risk_assessment':
        counter = claim.get('counter_evidence')
        if not isinstance(counter, list) or not counter or not claim.get('uncertainty') or claim.get('uncertainty') == '尚需核查':
            errors.append('缺少反例检索记录或具体不确定性说明')
        elif any(not isinstance(c, dict) or not c.get('text') or not isinstance(c.get('evidence_keys'), list) or any(k not in records for k in c['evidence_keys']) for c in counter):
            errors.append('反例证据结构或来源键无效')
    return errors


def render_report(state):
    lines = [f"# {state['focus']}", f"任务类型：{TYPE_LABELS[state['task_type']]}；时间范围：{state.get('time_scope') or '未限定'}",
             "以下结果保留资料条件与核查状态，未完成核查的内容请谨慎使用。"]
    issue_labels = dict(pending='待核查', draft='已研究，待核查', reviewed='已完成核查', carried='沿用历史结论', unresolved='仍有待核查内容')
    for key, issue in sorted(state["issues"].items()):
        lines.extend(["", "## " + issue["question"], f"处理结果：{issue_labels.get(issue['status'], '待核查')}；第{issue['revision']}版"])
        if issue.get('pending_reason') and issue['claims']:
            lines.append(issue['pending_reason'])
        if not issue["claims"]:
            lines.append(issue.get("pending_reason") or "本次安排内尚未形成结论，保留待核查。")
        for claim in issue["claims"]:
            verified = claim.get('verification_status', claim['status']) == 'supported' and issue['status'] != 'pending'
            label = '沿用' if verified and issue['status'] == 'carried' else '已核查' if verified else '待核查'
            lines.append(f"- 【{label}】{claim['text']}")
            if claim.get('conditions'):
                lines.append("  适用条件：" + claim['conditions'])
            if claim.get('uncertainty') and claim['uncertainty'] != '尚需核查':
                lines.append("  判断限制：" + claim['uncertainty'])
            for e in claim["evidence_keys"]:
                fp = claim.get('evidence_fingerprints', {}).get(e)
                current = state['evidence'].get(e, {})
                record = state.get('evidence_versions', {}).get(e, {}).get(fp) or (current if not fp or current.get('fingerprint') == fp else {})
                title = str(record.get('title') or e).replace('[', '［').replace(']', '］').replace('\n', ' ')
                date = record.get('published_at') or claim.get('source_times', {}).get(e)
                lines.append(f"  来源：[{title}]({e})" + (f"（资料时间：{date}）" if date else ""))
        if issue["status"] in ("pending", "unresolved"):
            lines.append("标为待核查的条目仍需补充资料或再次审核。")
    allocation = state.get('allocation') or {}
    delta = state['delta']
    lines.extend(["", "## 本次处理概况",
        f"资料新增{len(delta.get('added', []))}条、变化{len(delta.get('changed', []))}条、稳定{len(delta.get('stable', []))}条、本次未出现{len(delta.get('absent_from_snapshot', []))}条。",
        f"需要复核{len(state['affected'])}个问题；稳定沿用{sum(q['status'] == 'carried' for q in state['issues'].values())}个问题。",
        f"研究与核查已用{allocation.get('spent_units', 0)}次，最多{allocation.get('budget_units', 0)}次。详细过程与来源版本可在研究过程面板查看。"])
    warnings = list(dict.fromkeys(w['reason'] for a in state.get('actions', []) for w in a.get('retrieval_warnings', [])))
    if any(a.get('error_code') == 'retrieval_unavailable' for a in state.get('actions', [])):
        warnings.append('部分问题检索暂不可用，已保留其他研究结果；缺少证据的问题暂不能判断。')
    if warnings:
        lines.extend(['', '## 资料范围与限制'] + ['- ' + text for text in warnings])
    return "\n".join(lines)


def sanitize_claim(text, records):
    """Untrusted prose may contain URLs even when the structured citation list is valid."""
    def validate(match):
        value = match.group(0)
        return value if canonical_url(value.rstrip(".,;。；")) in records else "[未取得资料的链接已移除]"
    return re.sub(r"https?://[^\s)\]<>]+", validate, text)


def sanitize_metadata(value, records):
    if isinstance(value, str):
        return sanitize_claim(value, records)
    if isinstance(value, list):
        return [sanitize_metadata(item, records) for item in value]
    if isinstance(value, dict):
        return {key: item if key == 'evidence_keys' else sanitize_metadata(item, records) for key, item in value.items()}
    return value


def refresh_dependencies(state):
    versions = state.setdefault("evidence_versions", {})
    for key, record in state["evidence"].items():
        versions.setdefault(key, {}).setdefault(record["fingerprint"], deepcopy(record))
    relations = []
    conclusions = {}
    for qid, issue in state["issues"].items():
        issue['verification_status'] = 'supported' if issue['status'] in ('reviewed', 'carried') else 'pending_verification'
        issue['update_status'] = 'retained' if issue['status'] == 'carried' else 'revised' if issue['status'] == 'reviewed' else 'pending'
        for key in set(issue.get("signal_keys", []) + issue.get("evidence_keys", [])):
            relations.append(dict(kind="question_evidence", source=qid, target=key))
        for index, claim in enumerate(issue.get("claims", [])):
            claim.setdefault("id", digest([qid, index, claim["text"]])[:16])
            claim.setdefault("evidence_fingerprints", {k: state["evidence"][k]["fingerprint"] for k in claim.get("evidence_keys", []) if k in state["evidence"]})
            conclusions[claim["id"]] = dict(claim, question_id=qid)
            relations.append(dict(kind="question_claim", source=qid, target=claim["id"]))
            for key in claim.get("evidence_keys", []):
                relations.append(dict(kind="claim_evidence", source=claim["id"], target=key, fingerprint=claim["evidence_fingerprints"].get(key)))
    # Keep the last eight unreferenced versions plus any versions cited by
    # current or retained historical claims. Never silently lose cited originals.
    pinned = {}
    for issue in state["issues"].values():
        claims = issue.get("claims", []) + [c for h in issue.get("history", []) for c in h.get("claims", [])]
        for claim in claims:
            for key, fp in claim.get("evidence_fingerprints", {}).items():
                pinned.setdefault(key, set()).add(fp)
    for key, records in versions.items():
        keep = set(list(records)[-8:]) | pinned.get(key, set())
        versions[key] = {fp: record for fp, record in records.items() if fp in keep}
    state["dependency_graph"] = dict(Q=sorted(state["issues"]), E=sorted(state["evidence"]), C=conclusions, R=relations)
