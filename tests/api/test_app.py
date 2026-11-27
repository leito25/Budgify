from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]

PROTECTED = [
    ("get", "/api/me"),
    ("get", "/api/workspace"),
    ("get", "/api/search?q=a"),
    ("post", "/api/loans"),
    ("put", "/api/loans/x"),
    ("delete", "/api/loans/x"),
    ("post", "/api/loans/x/payments"),
    ("post", "/api/income"),
    ("put", "/api/income/x"),
    ("delete", "/api/income/x"),
]


def test_health_is_public(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_config_is_public_and_holds_only_the_publishable_values(client, settings):
    assert client.get("/config.json").json() == {
        "supabaseUrl": settings.supabase_url,
        "supabasePublishableKey": settings.supabase_publishable_key,
    }


@pytest.mark.parametrize(("method", "path"), PROTECTED)
def test_every_api_route_refuses_signed_out(client, method: str, path: str):
    assert getattr(client, method)(path).status_code == 401


def test_the_built_frontend_is_served(make_client, tmp_path):
    (tmp_path / "index.html").write_text("<title>Budgify</title>")
    with make_client(static_dir=tmp_path) as client:
        assert "Budgify" in client.get("/").text
        assert client.get("/api/workspace").status_code == 401


def test_main_does_not_import_the_test_sign_in():
    assert "testing" not in (ROOT / "api" / "main.py").read_text()


def test_the_docker_image_leaves_out_the_test_sign_in():
    ignored = (ROOT / ".dockerignore").read_text()
    assert "api/testing.py" in ignored
    assert "tests" in ignored
