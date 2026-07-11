from app.kpi import store


def setup_function():
    store.reset()


def test_metrics_compute_from_events():
    store.record({"kind": "generate", "deck_id": "d1", "slides": 6, "errors": 0, "repairs": 0, "latency_ms": 900})
    store.record({"kind": "regenerate", "deck_id": "d1", "preserved": 3, "changed": 2, "conflicts": 0})
    store.record({"kind": "ship", "deck_id": "d1", "edited_slides": 1, "total_slides": 6, "seconds_since_generate": 120})
    m = store.metrics()
    assert m["decks_generated"] == 1
    assert m["edits_preserved_on_regen"] == 3
    assert m["regenerate_clobber_rate_pct"] == 0.0
    assert m["first_pass_spec_validity_pct"] == 100.0


def test_clobber_rate_reflects_lost_edits():
    store.record({"kind": "regenerate", "deck_id": "d", "preserved": 8, "changed": 1, "conflicts": 0})
    store.record({"kind": "clobber", "deck_id": "d", "count": 2})
    m = store.metrics()
    assert m["regenerate_clobber_rate_pct"] == 20.0
