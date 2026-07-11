from app.compiler.pipeline import build, parse, lint


def test_clean_deck_compiles():
    src = 'deck "X"\ntheme midnight\nslide title\n  heading "Hi"'
    b = build(src)
    assert len(b["errors"]) == 0
    assert b["slides"] == 1


def test_broken_deck_heals_to_zero_errors():
    src = "slide bullets\n" + "".join(f'  point "p{i}"\n' for i in range(9)) + \
          'slide chart.bar\n  heading "c"\n  data A 1, B nope, C 3'
    b = build(src)
    assert len(b["errors"]) == 0
    codes = {r["code"] for r in b["repairs"]}
    assert "W201" in codes and "E302" in codes and "E001" in codes


def test_unknown_bind_errors():
    b = build('deck "X"\ntheme paper\nslide chart.bar\n  heading "h"\n  bind missing')
    assert any(d["code"] == "E310" for d in b["diagnostics"])


def test_dataset_bind_resolves_in_compile_layer_contract():
    # Python compiler validates bind existence; resolution to data happens client-side.
    src = 'deck "X"\ntheme paper\ndataset d\n  row A 1\n  row B 2\nslide chart.bar\n  heading "h"\n  bind d'
    b = build(src)
    assert len(b["errors"]) == 0


def test_repair_loop_is_bounded():
    src = "slide bullets\n" + "".join(f'  point "p{i}"\n' for i in range(40))
    b = build(src)
    assert b["passes"] <= 4
