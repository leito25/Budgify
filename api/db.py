import sqlite3
import threading
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Connection, Engine, create_engine, event
from sqlalchemy.pool import StaticPool


def _unicode_lower(value: str | None) -> str | None:
    return None if value is None else value.lower()


def _use_unicode_lower(connection: sqlite3.Connection, _record: Any) -> None:
    # SQLite's own lower() only folds ASCII, so "PANADERÍA" would miss "Panadería".
    connection.create_function("lower", 1, _unicode_lower, deterministic=True)


def create_sqlite_engine(url: str = "sqlite://") -> Engine:
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(engine, "connect", _use_unicode_lower)
    return engine


def create_postgres_engine(url: str) -> Engine:
    driver_url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    driver_url = driver_url.replace("postgres://", "postgresql+psycopg://", 1)
    # Supabase's transaction pooler does not support prepared statements.
    return create_engine(
        driver_url,
        pool_pre_ping=True,
        connect_args={"prepare_threshold": None},
    )


def create_db_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        return create_sqlite_engine(url)
    return create_postgres_engine(url)


# One shared SQLite connection is not safe for two requests at once.
_SQLITE_LOCK = threading.RLock()


@contextmanager
def transaction(engine: Engine) -> Generator[Connection]:
    """A transaction that commits when the block ends and rolls back on an error."""
    if engine.dialect.name == "sqlite":
        with _SQLITE_LOCK, engine.begin() as connection:
            yield connection
    else:
        with engine.begin() as connection:
            yield connection
