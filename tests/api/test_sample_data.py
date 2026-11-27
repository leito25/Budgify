from datetime import date

from sqlalchemy import Engine, func, select

from api.migrations import migrate
from api.sample_data import SAMPLE_PERSON_EMAIL, ensure_sample_data
from api.tables import income, loans, people

NOW = "2026-11-23T12:00:00+00:00"


def count(engine: Engine, table) -> int:
    with engine.connect() as connection:
        return connection.execute(select(func.count()).select_from(table)).scalar_one()


def test_sample_data_is_written_once(engine: Engine):
    migrate(engine)
    assert ensure_sample_data(engine, date(2026, 11, 23), NOW) is True
    assert ensure_sample_data(engine, date(2030, 1, 1), NOW) is False
    assert count(engine, loans) == 3
    assert count(engine, income) == 2


def test_sample_dates_are_relative_to_the_given_date(engine: Engine):
    migrate(engine)
    ensure_sample_data(engine, date(2026, 11, 23), NOW)
    with engine.connect() as connection:
        due = connection.execute(
            select(loans.c.name, loans.c.first_due_date).order_by(
                loans.c.first_due_date
            )
        ).all()
    assert due == [
        ("Coffee equipment", "2026-11-28"),
        ("Bakery oven", "2026-12-08"),
        ("Delivery equipment", "2026-12-18"),
    ]


def test_the_sample_person_has_a_made_up_ng_email(engine: Engine):
    migrate(engine)
    ensure_sample_data(engine, date(2026, 11, 23), NOW)
    assert SAMPLE_PERSON_EMAIL.endswith(".ng")
    with engine.connect() as connection:
        emails = connection.execute(select(people.c.email)).scalars().all()
    assert emails == [SAMPLE_PERSON_EMAIL]


def test_starting_the_app_writes_the_sample_data(client, ana):
    loans_ = client.get("/api/workspace", headers=ana).json()["loans"]
    assert {loan["addedBy"]["email"] for loan in loans_} == {SAMPLE_PERSON_EMAIL}
