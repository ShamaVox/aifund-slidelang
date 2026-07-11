from fastapi.testclient import TestClient
from app.main import app
from app.image.provider import get_provider, asset_id
from app.image.verifier import verify

client = TestClient(app)


def test_generation_is_deterministic():
    a = get_provider().generate("a clean product dashboard")
    b = get_provider().generate("a clean product dashboard")
    assert a.id == b.id and a.data_url == b.data_url  # same prompt -> same asset


def test_different_prompt_different_asset():
    a = get_provider().generate("dashboard")
    b = get_provider().generate("mountain")
    assert a.id != b.id


def test_verifier_blocks_brand_and_unsafe():
    assert verify("nike logo").ok is False
    assert verify("a clean editorial dashboard").ok is True


def test_image_endpoint_ok():
    r = client.post("/api/image", json={"prompt": "a muted editorial dashboard"})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] and body["data_url"].startswith("data:image/svg+xml;base64,")
    assert body["id"] == asset_id("a muted editorial dashboard")


def test_image_endpoint_blocks_bad_prompt():
    r = client.post("/api/image", json={"prompt": "the disney logo"})
    assert r.status_code == 422 and r.json()["ok"] is False
