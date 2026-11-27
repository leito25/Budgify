import os
from datetime import date

from dotenv import load_dotenv

from api.app import create_app
from api.auth import SupabaseVerifier
from api.db import create_db_engine
from api.settings import Settings

load_dotenv()
_settings = Settings.from_environment(os.environ)

app = create_app(
    _settings,
    SupabaseVerifier(_settings.supabase_url),
    create_db_engine(_settings.database_url),
    date.today(),
)
