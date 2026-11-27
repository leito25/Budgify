from fastapi import APIRouter, Request
from sqlalchemy import select

from api.auth import CurrentPerson
from api.db import transaction
from api.queries import load_people
from api.schemas import WorkspaceOut, income_out, loan_out, payment_out
from api.tables import income, loans, payments, workspace_settings

router = APIRouter(prefix="/api")


@router.get("/workspace")
def read_workspace(request: Request, _person: CurrentPerson) -> WorkspaceOut:
    with transaction(request.app.state.engine) as connection:
        people = load_people(connection)
        settings = connection.execute(select(workspace_settings)).one()
        loan_rows = connection.execute(
            select(loans).order_by(loans.c.added_at, loans.c.id)
        )
        payment_rows = connection.execute(
            select(payments).order_by(payments.c.loan_id, payments.c.installment_index)
        )
        income_rows = connection.execute(
            select(income).order_by(income.c.added_at, income.c.id)
        )
        return WorkspaceOut(
            region=settings.region,
            base_currency=settings.base_currency,
            loans=[loan_out(row, people) for row in loan_rows],
            payments=[payment_out(row, people) for row in payment_rows],
            income=[income_out(row, people) for row in income_rows],
        )
