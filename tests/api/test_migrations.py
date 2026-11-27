from sqlalchemy import Engine, inspect, select

from api.migrations import _applied, migrate, MIGRATIONS


def test_migrations_create_the_tables(engine: Engine):
    ran = migrate(engine)
    assert ran == [name for name, _ in MIGRATIONS]
    tables = set(inspect(engine).get_table_names())
    assert {"people", "loans", "payments", "income", "workspace_settings"} <= tables


def test_running_again_applies_nothing(engine: Engine):
    migrate(engine)
    assert migrate(engine) == []
    with engine.connect() as connection:
        rows = connection.execute(select(_applied.c.name)).all()
    assert len(rows) == len(MIGRATIONS)
