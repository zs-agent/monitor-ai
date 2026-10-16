"""Deterministic search cleanup; never guesses model identities or versions."""
import re

def normalize_query(value):
    value = re.sub(r'\b([A-Za-z][A-Za-z-]*)(\d+(?:\.\d+)+)', r'\1 \2', value)
    value = re.sub(r'(?<![A-Za-z0-9])top\s*1(?![A-Za-z0-9])', 'overall benchmark ranking', value, flags=re.I)
    value = re.sub(r'的综合实力|综合实力|是不是|是否|当下|目前|现在', ' ', value)
    return ' '.join(value.split())[:500]

def simplified_query(value):
    value = normalize_query(value)
    value = re.sub(r'\b(?:model benchmark capability|deployment cost|framework repository|security risk|release version)\b', '', value, flags=re.I)
    return ' '.join(value.split())[:500]
