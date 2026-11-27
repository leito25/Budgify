import socket
import time
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from api.app import create_app
from api.db import create_sqlite_engine
from api.settings import Settings
from api.testing import TestVerifier, access_token, router

FIXED_DAY = date(2026, 11, 23)
TIME_LIMIT_SECONDS = 1.0
LOOPBACK = ("127.0.0.1", "::1")


class Clock:
    def __init__(self) -> None:
        self.current = datetime(2026, 11, 23, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.current

    def advance(self, minutes: int = 1) -> None:
        self.current += timedelta(minutes=minutes)


@pytest.fixture(autouse=True)
def fail_slow_tests() -> Iterator[None]:
    started = time.perf_counter()
    yield
    elapsed = time.perf_counter() - started
    assert elapsed < TIME_LIMIT_SECONDS, f"took {elapsed:.2f}s, the limit is 1s"


@pytest.fixture(autouse=True)
def block_network(monkeypatch: pytest.MonkeyPatch) -> None:
    real_connect = socket.socket.connect

    def connect(self: socket.socket, address: object) -> None:
        host = address[0] if isinstance(address, tuple) else None
        if host not in LOOPBACK:
            raise AssertionError(f"Tests must not use the network: {address!r}")
        real_connect(self, address)  # ty: ignore[invalid-argument-type]

    monkeypatch.setattr(socket.socket, "connect", connect)


@pytest.fixture
def settings() -> Settings:
    return Settings("sqlite://", "https://test.supabase.invalid", "sb_publishable_test")


@pytest.fixture
def engine() -> Engine:
    return create_sqlite_engine()


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def make_client(
    settings: Settings, engine: Engine, clock: Clock
) -> Callable[..., TestClient]:
    def build(**overrides: Any) -> TestClient:
        options: dict[str, Any] = {
            "settings": settings,
            "verifier": TestVerifier(),
            "engine": engine,
            "today": FIXED_DAY,
            "now": clock,
            "static_dir": None,
            "extra_routers": [router],
        }
        return TestClient(create_app(**{**options, **overrides}))

    return build


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> Iterator[TestClient]:
    with make_client() as test_client:
        yield test_client


def sign_in_as(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token(key)}"}


@pytest.fixture
def ana() -> dict[str, str]:
    return sign_in_as("ana")


@pytest.fixture
def sam() -> dict[str, str]:
    return sign_in_as("sam")
