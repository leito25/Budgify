from collections.abc import Callable

from sqlalchemy import Column, Connection, Engine, MetaData, String, Table, select

from api.migrations import m0001_create_tables

Migration = Callable[[Connection], None]

MIGRATIONS: list[tuple[str, Migration]] = [
    ("m0001_create_tables", m0001_create_tables.upgrade),
]

_applied = Table(
    "schema_migrations",
    MetaData(),
    Column("name", String, primary_key=True),
)


def migrate(engine: Engine) -> list[str]:
    """Apply migrations that have not run yet, each in its own transaction."""
    with engine.begin() as connection:
        _applied.create(connection, checkfirst=True)
    ran: list[str] = []
    for name, upgrade in MIGRATIONS:
        with engine.begin() as connection:
            done = connection.execute(
                select(_applied.c.name).where(_applied.c.name == name)
            ).first()
            if done:
                continue
            upgrade(connection)
            connection.execute(_applied.insert().values(name=name))
            ran.append(name)
    return ran
