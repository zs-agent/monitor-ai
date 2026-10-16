"""Short actionable terminal errors derived from the actual action ledger."""
import re

def failure_summary(state):
    actions = state.get('actions') or []
    failed = [a for a in actions if a.get('outcome') == 'failed']
    if not failed:
        return '任务执行失败，未能完成研究；请查看运行记录'
    reasons = []
    for action in failed:
        message = str(action.get('error') or '未返回具体原因')
        message = re.sub(r'^[A-Za-z_][A-Za-z0-9_.]*Error:\s*', '', message)
        message = re.sub(r'(?i)(api[_-]?key|token|authorization|password)([=:]\s*)[^\s,&]+', r'\1\2[已隐藏]', message)
        message = re.sub(r'https?://[^\s]+', '[服务地址]', message)
        message = message[:250]
        if message not in reasons:
            reasons.append(message)
    total = sum(a.get('unit_cost', 0) > 0 for a in actions)
    return f'本次{total}次研究/核查中有{len(failed)}次失败。' + '；'.join(reasons[:2])
