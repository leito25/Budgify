import pytest

from api.settings import MissingSettingsError, Settings

VALUES = {
    "DATABASE_URL": "postgresql://user:pass@host:5432/postgres",
    "SUPABASE_URL": "https://abc.supabase.co/",
    "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_abc",
}


def test_reads_the_three_settings():
    settings = Settings.from_environment(VALUES)
    assert settings.database_url == VALUES["DATABASE_URL"]
    assert settings.supabase_url == "https://abc.supabase.co"
    assert settings.supabase_publishable_key == "sb_publishable_abc"


@pytest.mark.parametrize("name", list(VALUES))
def test_a_missing_setting_stops_the_app(name: str):
    values = {key: value for key, value in VALUES.items() if key != name}
    with pytest.raises(MissingSettingsError, match=name):
        Settings.from_environment(values)


def test_a_blank_setting_counts_as_missing():
    with pytest.raises(MissingSettingsError):
        Settings.from_environment({**VALUES, "DATABASE_URL": "  "})


def test_tests_build_the_app_without_an_env_file(client):
    assert client.get("/health").status_code == 200


def test_production_start_up_stops_when_a_setting_is_missing(monkeypatch):
    import importlib

    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: False)
    for name in VALUES:
        monkeypatch.delenv(name, raising=False)
    with pytest.raises(MissingSettingsError):
        importlib.import_module("api.main")
