import pytest
from backend.app.services.template_service import extract_variables, render_template

def test_extract_variables():
    tpl = "Hello {name}, welcome to {company}! Category: {category}."
    vars = extract_variables(tpl)
    assert sorted(vars) == ["category", "company", "name"]

def test_render_template_all_variables():
    tpl = "Hello {name}, thanks for visiting {company}."
    context = {"name": "Alice", "company": "Wonderland Ltd"}
    rendered, missing = render_template(tpl, context)
    assert rendered == "Hello Alice, thanks for visiting Wonderland Ltd."
    assert missing == []

def test_render_template_missing_variables():
    tpl = "Hi {name}, how is {company} doing in {category}?"
    context = {"name": "Bob"}
    rendered, missing = render_template(tpl, context)
    assert "Bob" in rendered
    assert "company" in missing
    assert "category" in missing
