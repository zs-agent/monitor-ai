"""Offline human annotation CLI: prepare / validate / recheck / summarize."""
import argparse
import json
from pathlib import Path
from service.manual_evaluation import make_template, validation_errors, recheck_ids, summarize


def load(path): return json.loads(Path(path).read_text(encoding='utf-8'))

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action',choices=['prepare','validate','recheck','summarize'])
    parser.add_argument('--plan'); parser.add_argument('--runs'); parser.add_argument('--sheet'); parser.add_argument('--key')
    parser.add_argument('--seed',type=int,default=20261020); parser.add_argument('--output',required=True)
    args=parser.parse_args()
    out=Path(args.output); out.parent.mkdir(parents=True,exist_ok=True)
    if args.action=='prepare':
        runs=load(args.runs)
        for run in runs:
            if run.get('path'):
                record=load(run['path']); run.update(structured_state=record.get('structured_state'),status=record.get('status') or record.get('execution_status'))
        sheet,key=make_template(load(args.plan),runs,args.seed)
        out.write_text(json.dumps(sheet,ensure_ascii=False,indent=2),encoding='utf-8')
        private=out.with_suffix('.private-key.json'); private.write_text(json.dumps(key,ensure_ascii=False,indent=2),encoding='utf-8')
        print('24个匿名槽位已生成；映射文件仅在标注完成后用于汇总：'+str(private)); return
    sheet=load(args.sheet)
    if args.action in ('validate','summarize') and not args.key:
        parser.error('validate/summarize需要--key，以核对固定槽位和原始记录，不会输出方法映射')
    result=validation_errors(sheet,True,load(args.key)) if args.action=='validate' else recheck_ids(sheet,args.seed) if args.action=='recheck' else summarize(sheet,load(args.key))
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    if args.action=='validate' and result: raise SystemExit(1)

if __name__=='__main__': main()
