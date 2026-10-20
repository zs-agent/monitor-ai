"""Single-researcher blinded templates. No automatic verdict is a human annotation."""
from copy import deepcopy
from datetime import datetime, timezone, timedelta
import math
import random
from .research_state import digest

METHODS = ('adaptive', 'fixed', 'greedy')
VERDICTS = ('supported', 'contradicted', 'insufficient')


def make_template(plan, runs, seed):
    if len(plan) != 8 or len({(q['object_id'],q['id']) for q in plan}) != 8:
        raise ValueError('抽样清单必须固定8个不同子问题')
    if len({q['object_id'] for q in plan}) < 4:
        raise ValueError('至少覆盖4个对象')
    types = ('fact_check','object_comparison','dynamic_analysis','risk_assessment')
    if any(sum(q['task_type']==t for q in plan)!=2 for t in types):
        raise ValueError('四类任务各需2题')
    index = {}
    for run in runs:
        if run.get('repeat') != 0 or run.get('budget_scale') != 1 or run.get('method') not in METHODS:
            raise ValueError('人工样本仅接受主实验首轮B=N的三个配置')
        key = (run['object_id'], run['method'])
        if key in index: raise ValueError('同对象同配置运行重复')
        index[key] = run
    answers, private = [], {}
    for q in plan:
        for method in METHODS:
            run = index.get((q['object_id'],method), {})
            state = run.get('structured_state') or {}
            issue = state.get('issues', {}).get(q['id'], {})
            original_claims = deepcopy(issue.get('claims', []))
            claims = original_claims if run.get('status') in ('done','partial','completed') else []
            original_text = '\n'.join(c['text'] for c in claims)
            sources = {k:deepcopy(v) for k,v in state.get('evidence',{}).items() if any(k in c.get('evidence_keys',[]) for c in claims)}
            aid = digest([seed, q['object_id'],q['id'],method])[:16]
            original_hashes = dict(original_claims_digest=digest(original_claims), original_answer_digest=digest(original_text), original_sources_digest=digest(sources))
            private[aid] = dict(method=method, object_id=q['object_id'], question_id=q['id'], task_type=q['task_type'], status=run.get('status','missing_run'),
                original_claims=original_claims, original_answer_text=original_text, original_answer_preview=original_text[:500], original_answered=bool(claims), **original_hashes)
            facts = [dict(fact_id=aid+'-'+str(i), text=c['text'], source_keys=deepcopy(c.get('evidence_keys',[])), location='',
                          confirmed_split=False, initial=None, recheck=None, resolution=None) for i,c in enumerate(claims)]
            answers.append(dict(answer_id=aid, object_id=q['object_id'], question_id=q['id'], task_type=q['task_type'],
                question=q.get('question') or issue.get('question',''), answered=bool(claims),
                coverage=False if not claims else None, facts=facts, facts_complete_confirmed=False,
                original_answer_text=original_text, sources=sources, **original_hashes))
    random.Random(seed).shuffle(answers)
    sheet = dict(protocol='single-researcher-v3', seed=seed, plan_hash=digest(plan), answers=answers,
        instructions='对照保留的original_answer_text确认并拆分复合事实，完成后填写facts_complete_confirmed=true；无引用事实不得删除，应标依据不足。原始回答、来源和摘要不可修改。缺少版本/测试条件支撑须核查。coverage由人工按核查要点填写。初判填写verdict/location/reviewed_at，复查不覆盖初判。')
    return sheet, private


def validation_errors(sheet, require_complete=False, private=None):
    errors, ids, fact_ids = [], set(), set()
    if len(sheet.get('answers',[])) != 24: errors.append('应保留24个固定回答槽位')
    for answer in sheet.get('answers',[]):
        if answer['answer_id'] in ids: errors.append('重复回答ID')
        ids.add(answer['answer_id'])
        if not answer['answered'] and answer.get('coverage') is not False: errors.append('无回答覆盖必须为false')
        if not answer['answered'] and answer.get('facts'): errors.append('无回答槽位不得附加事实')
        if type(answer.get('answered')) is not bool: errors.append('answered须为布尔值')
        if require_complete and type(answer.get('coverage')) is not bool: errors.append('覆盖判定未完成')
        if require_complete and answer['answered'] and answer.get('facts_complete_confirmed') is not True:
            errors.append('须人工对照原始回答确认事实拆分完整；程序不自动推断完整性')
        if private is not None and answer['answer_id'] in private:
            original = private[answer['answer_id']]
            if any(answer.get(field) != original.get(field) for field in ('object_id','question_id','task_type')) or answer['answered'] != original.get('original_answered'):
                errors.append('固定回答身份或有无回答状态被改动')
            if original.get('method') not in METHODS or digest([sheet.get('seed'),original.get('object_id'),original.get('question_id'),original.get('method')])[:16] != answer['answer_id']:
                errors.append('固定映射身份摘要无效')
            if digest(original.get('original_claims')) != original.get('original_claims_digest') or digest(original.get('original_answer_text')) != original.get('original_answer_digest'):
                errors.append('私有归档的原始回答或claims已丢失或改动')
            if any(answer.get(field) != original.get(field) for field in ('original_claims_digest','original_answer_digest','original_sources_digest')):
                errors.append('原始内容摘要与固定归档不一致')
            if digest(answer.get('original_answer_text')) != original.get('original_answer_digest') or digest(answer.get('sources')) != original.get('original_sources_digest'):
                errors.append('原始回答文本或来源集合已改动')
        for fact in answer['facts']:
            if not fact.get('fact_id') or fact['fact_id'] in fact_ids: errors.append('事实ID缺失或重复')
            fact_ids.add(fact.get('fact_id'))
            initial = fact.get('initial')
            if require_complete and (not fact.get('confirmed_split') or not initial): errors.append('事实拆分或初判尚未完成')
            if initial and initial.get('verdict') not in VERDICTS: errors.append('初判枚举无效')
            if initial and (not initial.get('location') or not initial.get('reviewed_at')): errors.append('初判缺少定位或时间')
            if initial:
                try: datetime.fromisoformat(initial['reviewed_at'])
                except (KeyError,TypeError,ValueError): errors.append('初判时间须为ISO日期时间')
            if initial and not fact.get('source_keys') and initial.get('verdict') == 'supported': errors.append('无引用事实不可标支持')
            if any(isinstance(fact.get(field),dict) and fact[field].get('verdict')=='supported' for field in ('initial','recheck','resolution')):
                keys = fact.get('source_keys')
                if not isinstance(keys,list) or not keys or any(not isinstance(key,str) or key not in answer.get('sources',{}) for key in keys):
                    errors.append('支持判定必须引用该回答实际提供的来源键，禁止虚构引用')
            if not fact.get('source_keys') and any(isinstance(fact.get(field),dict) and fact[field].get('verdict')=='supported' for field in ('recheck','resolution')):
                errors.append('无引用事实不可在复查或分歧处理中标支持')
            if fact.get('recheck'):
                try:
                    first = datetime.fromisoformat(initial['reviewed_at'])
                    second = datetime.fromisoformat(fact['recheck']['reviewed_at'])
                    if second-first < timedelta(days=7): errors.append('复查间隔不足7天')
                except (KeyError,TypeError,ValueError): errors.append('复查时间无效')
                if fact['recheck'].get('verdict') not in VERDICTS: errors.append('复查判定无效')
                if fact['recheck'].get('verdict') != (initial or {}).get('verdict') and not fact.get('resolution'):
                    errors.append('复查分歧须记录处理理由，未解决按依据不足')
                resolution = fact.get('resolution')
                if resolution and (not isinstance(resolution,dict) or resolution.get('verdict') not in VERDICTS or not resolution.get('reason')):
                    errors.append('分歧处理须含最终判定和理由')
    if private is not None and (len(private) != 24 or ids != set(private)):
        errors.append('24个回答ID必须与冻结私有映射完全一致，不得缺槽、换槽或补样')
    return errors


def recheck_ids(sheet, seed, now=None):
    now = now or datetime.now(timezone.utc)
    eligible = []
    for answer in sheet['answers']:
        for fact in answer['facts']:
            initial = fact.get('initial')
            if not initial: continue
            first = datetime.fromisoformat(initial['reviewed_at'])
            if first.tzinfo is None: first=first.replace(tzinfo=timezone.utc)
            if now-first >= timedelta(days=7): eligible.append(fact['fact_id'])
    return random.Random(seed).sample(sorted(eligible), math.ceil(len(eligible)*.2))


def summarize(sheet, private):
    errors = validation_errors(sheet, require_complete=True, private=private)
    if errors: raise ValueError('; '.join(sorted(set(errors))))
    answered = {m:set() for m in METHODS}
    for a in sheet['answers']:
        key=private[a['answer_id']]
        if a['answered']: answered[key['method']].add((key['object_id'],key['question_id']))
    common=set.intersection(*answered.values())
    def stats(rows):
        facts=[f for a in rows for f in a['facts']]
        def verdict(f):
            second=f.get('recheck')
            if second and second['verdict'] != f['initial']['verdict']:
                return (f.get('resolution') or {}).get('verdict','insufficient')
            return f['initial']['verdict']
        return dict(questions=len(rows), answered=sum(a['answered'] for a in rows), no_answer=sum(not a['answered'] for a in rows),
                    effective_coverage=sum(a['coverage'] is True for a in rows)/len(rows) if rows else None,
                    atomic_facts=len(facts), content_support=sum(verdict(f)=='supported' for f in facts)/len(facts) if facts else None)
    result={m:dict(all=stats([a for a in sheet['answers'] if private[a['answer_id']]['method']==m]),
                   common_answered=stats([a for a in sheet['answers'] if private[a['answer_id']]['method']==m and
                    (private[a['answer_id']]['object_id'],private[a['answer_id']]['question_id']) in common])) for m in METHODS}
    checks=[f for a in sheet['answers'] for f in a['facts'] if f.get('recheck')]
    return dict(scope='首轮24槽位人工评价；不代表三轮全量质量', methods=result,
                fixed_slots_verified=True, original_records_verified=True,
                rechecked=len(checks), consistency=sum(f['initial']['verdict']==f['recheck']['verdict'] for f in checks)/len(checks) if checks else None)
