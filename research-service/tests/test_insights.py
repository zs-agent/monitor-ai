from fastapi.testclient import TestClient
from service.app import app
from service import insights

def test_insights_bounds_and_existing_provider_contract(monkeypatch):
    calls = []
    async def generate(req):
        calls.append(req)
        return dict(text="当前资料概览", model="configured", model_calls=1, usage=None)
    monkeypatch.setattr(insights, "generate_title_summary", generate)
    with TestClient(app) as client:
        r=client.post("/insights/summary",json=dict(category="papers",locale="zh",titles=["A real paper"]))
        assert r.status_code == 200 and r.json()["model_calls"] == 1
        assert calls[0].titles == ["A real paper"]
        for titles in [[], ["x"]*21, [" "], ["x"*501]]:
            assert client.post("/insights/summary",json=dict(category="papers",titles=titles)).status_code == 422
        assert client.post("/insights/summary",json=dict(category="unknown",titles=["x"])).status_code == 422

def test_insights_failure_does_not_expose_secrets_or_create_report(monkeypatch):
    async def generate(req):
        raise RuntimeError("provider secret details")
    monkeypatch.setattr(insights, "generate_title_summary", generate)
    with TestClient(app) as client:
        r=client.post("/insights/summary",json=dict(category="papers",titles=["title"]))
        assert r.status_code == 503
        assert "secret" not in r.text
