"""The app for end-to-end tests and ui-check: fixed sample data, a fixed date,
an in-memory database and a test sign-in. It never loads .env and never contacts Supabase.

    uv run python tests/e2e/server.py --port 4173
"""

import argparse
import sys
from datetime import UTC, date, datetime
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from api.app import create_app
from api.db import create_sqlite_engine
from api.settings import Settings
from api.testing import TestVerifier, router

FIXED_DAY = date(2026, 11, 23)
FIXED_NOW = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)


def build_app():
    settings = Settings("sqlite://", "", "sb_publishable_test_only")
    return create_app(
        settings,
        TestVerifier(),
        create_sqlite_engine(),
        FIXED_DAY,
        now=lambda: FIXED_NOW,
        extra_routers=[router],
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4173)
    arguments = parser.parse_args()
    uvicorn.run(build_app(), host="127.0.0.1", port=arguments.port, log_level="warning")
