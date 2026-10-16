"""Inspectable numerators/denominators; unknown ground truth is never zero."""
def ratio(numerator, denominator, basis):
    return dict(numerator=numerator, denominator=denominator,
                value=numerator / denominator if denominator else None, basis=basis)


def evaluate(state):
    questions = list(state['issues'].values())
    claims = [c for q in questions for c in q['claims']]
    labels = state.get('evaluation_labels', {})
    expected = labels.get('expected_update_ids')
    stale = labels.get('stale_claim_texts')
    reviews = state.get('human_reviews', [])
    latest_reviews = list({(r['claim_id'], r['reviewer']): r for r in reviews}.values())
    return dict(
        key_question_coverage=ratio(sum(bool(q['claims']) for q in questions), len(questions), '已产生结论的问题/规划问题；不等于正确率'),
        citation_coverage=ratio(sum(bool(c.get('evidence_keys')) for c in claims), len(claims), '有引用的结论/应提供引用的全部结论'),
        link_availability=ratio(sum(e.get('link_available') is True for e in state['evidence'].values()),
                                sum(e.get('link_available') is not None for e in state['evidence'].values()), '仅计算实际检查过的链接；离线样例不冒充联网检查'),
        content_support=ratio(sum(c.get('verification_status', c.get('status')) == 'supported' for c in claims), len(claims), '获支持结论/全部结论（模型辅助）；不等于每条引用均获独立支持，人工核查单列'),
        update_coverage=ratio(sum(state['issues'].get(k, {}).get('status') == 'reviewed' for k in expected or []), len(expected or []), '预先标注的应更新问题；无标注时未知'),
        stale_retention=ratio(sum(c['text'] in stale and c.get('update_status') == 'retained' for c in claims) if stale is not None else 0,
                              len(stale or []), '标注为过时的历史结论；无标注时未知'),
        human_support=ratio(sum(r['verdict'] == 'supported' for r in latest_reviews), len(latest_reviews), '各评阅者对各结论的最新抽样判定；不冒充全量质量'),
        sampled_claims=len({r['claim_id'] for r in reviews}),
        disagreements=sum(len({r['verdict'] for r in latest_reviews if r['claim_id'] == cid}) > 1 for cid in {r['claim_id'] for r in latest_reviews}),
        consumption=state.get('consumption', {}),
    )
