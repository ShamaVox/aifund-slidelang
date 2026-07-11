import pytest
from app.agent.loop import author
from app.agent.deterministic import simulate_author
from app.compiler.pipeline import build


@pytest.mark.asyncio
async def test_deterministic_author_produces_valid_spec():
    r = await author("Seed pitch for an AI startup", use_model=False)
    assert r.used_model is False
    assert r.errors == 0
    assert any(s.stage == "verify" for s in r.trace)


@pytest.mark.asyncio
async def test_author_trace_has_pipeline_stages():
    r = await author("technical design review", use_model=False)
    stages = [s.stage for s in r.trace]
    assert "plan" in stages and "author" in stages and "verify" in stages


def test_simulate_author_all_prompts_compile():
    for p in ["seed pitch", "technical design review", "quarterly update"]:
        assert len(build(simulate_author(p))["errors"]) == 0
