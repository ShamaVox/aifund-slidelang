from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_author_endpoint_deterministic():
    r = client.post("/api/author", json={"prompt": "seed pitch", "use_model": False})
    assert r.status_code == 200
    body = r.json()
    assert body["errors"] == 0 and body["used_model"] is False
    assert len(body["trace"]) >= 3


def test_compile_endpoint():
    r = client.post("/api/compile", json={"spec": 'deck "X"\ntheme paper\nslide title\n  heading "h"'})
    assert r.status_code == 200 and r.json()["slides"] == 1


def test_publish_roundtrip():
    spec = 'deck "P"\ntheme paper\nslide title\n  heading "Published"'
    pub = client.post("/api/publish", json={"spec": spec}).json()
    got = client.get(pub["url"])
    assert got.status_code == 200 and got.json()["title" if False else "slides"] == 1


def test_kpi_and_metrics():
    client.post("/api/kpi/event", json={"kind": "generate", "deck_id": "d", "slides": 6, "errors": 0, "repairs": 0})
    m = client.get("/api/kpi/metrics").json()
    assert m["events_total"] >= 1


def test_eval_endpoint():
    r = client.get("/api/eval")
    assert r.status_code == 200 and r.json()["passed"] == r.json()["total"]
