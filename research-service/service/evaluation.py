"""Inspectable numerators/denominators; unknown ground truth is never zero."""
def ratio(numerator, denominator, basis):
    return dict(numerator=numerator, denominator=denominator,
                value=numerator / denominator if denominator else None, basis=basis)


def association_metrics(state, labels):
    truth = labels.get('associations')
    if truth is None:
        return dict(precision=ratio(0,0,'未提供关联真值'), recall=ratio(0,0,'未提供关联真值'))
    if not isinstance(truth,dict) or any(not isinstance(v,list) for v in truth.values()):
        raise ValueError('associations真值须为来源键到问题ID列表')
    expected = {(key,qid) for key,ids in truth.items() for qid in ids}
    predicted = {(row['key'],qid) for row in state['association']['matches'] for qid in row['question_ids']}
    correct = len(expected & predicted)
    return dict(precision=ratio(correct,len(predicted),'自动来源—问题关联对'),
                recall=ratio(correct,len(expected),'预先标注来源—问题关联对'))


def evaluate(state):
    questions = list(state['issues'].values())
    claims = [c for q in questions for c in q['claims']]
    labels = state.get('evaluation_labels', {})
    expected = labels.get('expected_update_ids')
    stale = labels.get('stale_claim_texts')
    reviews = state.get('human_reviews', [])
    latest_reviews = list({(r['claim_id'], r['reviewer']): r for r in reviews}.values())
    selected = {a['issue_id'] for a in state.get('allocation',{}).get('selected',[])} | {a['issue_id'] for a in state.get('actions',[]) if a.get('feedback')}
    case_reviews = labels.get('case_fact_reviews', {})
    def manual_case_metric(name, field, basis):
        rows = case_reviews.get(name, [])
        result = ratio(sum(row.get(field) is True for row in rows),len(rows),basis)
        pending=sum(type(row.get(field)) is not bool or not row.get('notes') or not row.get('reviewed_at') for row in rows)
        result['pending_annotations']=pending
        if pending: result['value']=None
        return result
    return dict(
        key_question_coverage=ratio(sum(bool(q['claims']) and q.get('status') in ('reviewed', 'carried') and all(c.get('verification_status', c.get('status')) == 'supported' for c in q['claims']) for q in questions), len(questions), '自动核验通过的问题/全部规划问题；不等于人工确认覆盖率'),
        citation_coverage=ratio(sum(bool(c.get('evidence_keys')) for c in claims), len(claims), '有引用的结论/应提供引用的全部结论'),
        link_availability=ratio(sum(e.get('link_available') is True for e in state['evidence'].values()),
                                sum(e.get('link_available') is not None for e in state['evidence'].values()), '仅计算实际检查过的链接；离线样例不冒充联网检查'),
        content_support=ratio(sum(c.get('verification_status', c.get('status')) == 'supported' for c in claims), len(claims), '获支持结论/全部结论（模型辅助）；不等于每条引用均获独立支持，人工核查单列'),
        update_coverage=ratio(sum(k in selected for k in expected or []), len(expected or []), '应更新问题中获分配动作的比例；失败仍记录为已选，不等于正确更新率'),
        verified_update_coverage=ratio(sum(state['issues'].get(k,{}).get('status')=='reviewed' for k in expected or []),len(expected or []),'获模型审核通过的应更新问题；人工正确修订另行判定'),
        manual_stale_retention=manual_case_metric('invalid_t1_facts','stale_present','人工逐项检查已失效T1事实是否仍作为有效内容出现，含语义改写'),
        unjustified_stable_change=manual_case_metric('stable_t1_facts','changed_without_basis','人工检查稳定事实是否发生无新依据的实质改变；措辞变化不计'),
        stale_retention=ratio(len({c['text'] for c in claims if c['text'] in set(stale or []) and c.get('verification_status', c.get('status')) == 'supported'}),
                              len(set(stale or [])), '按文本标注仍作为有效内容出现的过时结论；无标注时未知'),
        human_support=ratio(sum(r['verdict'] == 'supported' for r in latest_reviews), len(latest_reviews), '各评阅者对各结论的最新抽样判定；不冒充全量质量'),
        sampled_claims=len({r['claim_id'] for r in reviews}),
        disagreements=sum(len({r['verdict'] for r in latest_reviews if r['claim_id'] == cid}) > 1 for cid in {r['claim_id'] for r in latest_reviews}),
        consumption=state.get('consumption', {}),
    )
