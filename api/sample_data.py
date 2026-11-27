from datetime import date, timedelta

from sqlalchemy import Engine, select

from api.db import transaction
from api.tables import income, loans, people, workspace_settings

SAMPLE_PERSON_ID = "sample-person"
SAMPLE_PERSON_EMAIL = "team@sample-business.ng"


def _loan(
    key: str,
    name: str,
    principal_minor: int,
    term_months: int,
    first_due: date,
    rate: float,
) -> dict[str, object]:
    return {
        "id": f"business-{key}",
        "name": name,
        "description": "",
        "principal_minor": principal_minor,
        "term_months": term_months,
        "rate": rate,
        "rate_basis": "effective_annual",
        "interest_type": "compound",
        "penalty_rate_annual": 0.12,
        "first_due_date": first_due.isoformat(),
    }


def _income(
    key: str, source: str, amount_minor: int, received: date, frequency: str
) -> dict[str, object]:
    return {
        "id": f"business-{key}",
        "source": source,
        "description": "",
        "amount_minor": amount_minor,
        "date_received": received.isoformat(),
        "frequency": frequency,
    }


def _sample_loans(today: date) -> list[dict[str, object]]:
    return [
        _loan("cafe", "Coffee equipment", 18_000_000, 18, today + timedelta(5), 0.24),
        _loan("bakery", "Bakery oven", 12_500_000, 12, today + timedelta(15), 0.22),
        _loan(
            "delivery", "Delivery equipment", 9_000_000, 10, today + timedelta(25), 0.2
        ),
    ]


def _sample_income(today: date) -> list[dict[str, object]]:
    return [
        _income("sales", "Monthly sales", 60_000_000, today, "recurring"),
        _income("order", "Panadería seasonal order", 4_000_000, today, "one_time"),
    ]


def ensure_sample_data(engine: Engine, today: date, now: str) -> bool:
    """Write the Small Business sample records the first time, and never again."""
    with transaction(engine) as connection:
        if connection.execute(select(workspace_settings.c.id)).first():
            return False
        connection.execute(
            people.insert().values(
                id=SAMPLE_PERSON_ID,
                email=SAMPLE_PERSON_EMAIL,
                name="Sample Team",
                updated_at=now,
            )
        )
        connection.execute(
            workspace_settings.insert().values(id=1, region="CO", base_currency="COP")
        )
        audit = {
            "added_by": SAMPLE_PERSON_ID,
            "added_at": now,
            "changed_by": SAMPLE_PERSON_ID,
            "changed_at": now,
        }
        connection.execute(
            loans.insert(), [{**row, **audit} for row in _sample_loans(today)]
        )
        connection.execute(
            income.insert(), [{**row, **audit} for row in _sample_income(today)]
        )
    return True
