from copy import deepcopy
import pytest
from service.manual_evaluation import make_template, validation_errors, summarize, METHODS
from service.research_state import digest


def complete_sheet():
    kinds=('fact_check','object_comparison','dynamic_analysis','risk_assessment')
    plan=[dict(id=str(i),object_id=str(i//2),task_type=kind) for i,kind in enumerate(kinds*2)]
    runs=[]
    for object_id in ('0','1','2','3'):
        key='https://example.org/'+object_id
        issues={q['id']:dict(claims=[dict(text='First atomic statement; second atomic statement.',evidence_keys=[key])]) for q in plan if q['object_id']==object_id}
        for method in METHODS:
            runs.append(dict(object_id=object_id,method=method,repeat=0,budget_scale=1,status='done',
                             structured_state=dict(issues=issues,evidence={key:dict(content='Original evidence')})))
    sheet,private=make_template(plan,runs,99)
    for answer in sheet['answers']:
        answer.update(coverage=True,facts_complete_confirmed=True)
        for fact in answer['facts']:
            fact.update(confirmed_split=True,initial=dict(verdict='supported',location='source paragraph 1',reviewed_at='2026-10-20T00:00:00+00:00'))
    return sheet,private


def test_supported_fact_rejects_fabricated_source_key():
    sheet,private=complete_sheet()
    assert not validation_errors(sheet,True,private)
    sheet['answers'][0]['facts'][0]['source_keys']=['https://fabricated.invalid/proof']
    assert any('虚构' in error for error in validation_errors(sheet,True,private))
    with pytest.raises(ValueError,match='虚构'): summarize(sheet,private)


def test_fixed_mapping_rejects_replaced_slot_and_no_answer_facts():
    sheet,private=complete_sheet()
    sheet['answers'][0]['answer_id']='replacement'
    assert len(sheet['answers'])==24
    with pytest.raises(ValueError,match='24个回答ID'): summarize(sheet,private)
    sheet,private=complete_sheet()
    answer=sheet['answers'][0]
    answer['answered']=False
    answer['coverage']=False
    assert any('不得附加事实' in error for error in validation_errors(sheet,True,private))
    answer['coverage']=True
    assert any('无回答覆盖' in error for error in validation_errors(sheet,True,private))


def test_original_records_survive_fact_split_and_are_checked():
    sheet,private=complete_sheet()
    answer=sheet['answers'][0]
    aid=answer['answer_id']
    original=deepcopy(private[aid]['original_claims'])
    first=answer['facts'][0]
    first['text']='First atomic statement.'
    second=deepcopy(first)
    second.update(fact_id=first['fact_id']+'-split',text='Second atomic statement.')
    answer['facts'].append(second)
    assert private[aid]['original_claims']==original
    assert private[aid]['original_answer_preview']=='First atomic statement; second atomic statement.'
    assert digest(original)==private[aid]['original_claims_digest']
    result=summarize(sheet,private)
    assert result['original_records_verified'] and result['fixed_slots_verified']
    # This verifies preservation, not whether the human chose the right split.
    answer['original_answer_text']='Deleted original sentence'
    with pytest.raises(ValueError,match='原始回答文本'): summarize(sheet,private)
    sheet,private=complete_sheet()
    private[sheet['answers'][0]['answer_id']]['original_claims']=[]
    with pytest.raises(ValueError,match='原始回答或claims'): summarize(sheet,private)
