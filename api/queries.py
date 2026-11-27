from typing import Any

from sqlalchemy import Connection, Row, select

from api.schemas import People, PersonRef
from api.tables import income, loans, payments, people


def load_people(connection: Connection) -> People:
    rows = connection.execute(select(people)).all()
    return {
        row.id: PersonRef(id=row.id, name=row.name, email=row.email) for row in rows
    }


def find_loan(connection: Connection, loan_id: str) -> Row[Any] | None:
    return connection.execute(select(loans).where(loans.c.id == loan_id)).first()


def find_income(connection: Connection, income_id: str) -> Row[Any] | None:
    return connection.execute(select(income).where(income.c.id == income_id)).first()


def find_payment(
    connection: Connection, loan_id: str, installment_index: int
) -> Row[Any] | None:
    return connection.execute(
        select(payments).where(
            payments.c.loan_id == loan_id,
            payments.c.installment_index == installment_index,
        )
    ).first()
