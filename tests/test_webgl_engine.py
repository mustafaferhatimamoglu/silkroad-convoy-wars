"""
Unit Tests for WebGL Engine and Assets
"""
import os

def test_webgl_files_exist():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    index_html = os.path.join(base_dir, "src", "engine", "index.html")
    engine_js = os.path.join(base_dir, "src", "engine", "engine.js")
    assert os.path.exists(index_html), "index.html mevcut olmalıdır."
    assert os.path.exists(engine_js), "engine.js mevcut olmalıdır."
    with open(index_html, "r", encoding="utf-8") as f:
        content = f.read()
        assert "hp-globe" in content
        assert "zerk-gauge" in content
