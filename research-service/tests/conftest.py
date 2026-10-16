import pytest

@pytest.fixture(autouse=True)
def isolate_optional_network_fallback(monkeypatch):
    # Unit tests opt into each domestic adapter explicitly; never call live registries.
    monkeypatch.setenv('RESEARCH_DOMESTIC_FALLBACK', '')
