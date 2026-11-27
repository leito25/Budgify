import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import delete

from api.auth import CurrentPerson
from api.db import transaction
from api.queries import find_loan, find_payment, load_people
from api.schemas import LoanIn, LoanOut, PaymentIn, PaymentOut, loan_out, payment_out
from api.tables import loans, payments

router = APIRouter(prefix="/api/loans")


def _loan_values(loan: LoanIn) -> dict[str, object]:
    return {
        **loan.model_dump(exclude={"first_due_date"}),
        "first_due_date": loan.first_due_date.isoformat(),
    }


def _payment_values(payment: PaymentIn) -> dict[str, object]:
    return {
        **payment.model_dump(exclude={"paid_date"}),
        "paid_date": payment.paid_date.isoformat(),
    }


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Loan not found.")


@router.post("", status_code=201)
def create_loan(loan: LoanIn, request: Request, person: CurrentPerson) -> LoanOut:
    now = request.app.state.now()
    loan_id = str(uuid.uuid4())
    with transaction(request.app.state.engine) as connection:
        connection.execute(
            loans.insert().values(
                id=loan_id,
                **_loan_values(loan),
                added_by=person.id,
                added_at=now,
                changed_by=person.id,
                changed_at=now,
            )
        )
        row = find_loan(connection, loan_id)
        assert row is not None
        return loan_out(row, load_people(connection))


@router.put("/{loan_id}")
def update_loan(
    loan_id: str, loan: LoanIn, request: Request, person: CurrentPerson
) -> LoanOut:
    with transaction(request.app.state.engine) as connection:
        if find_loan(connection, loan_id) is None:
            raise _not_found()
        connection.execute(
            loans.update()
            .where(loans.c.id == loan_id)
            .values(
                **_loan_values(loan),
                changed_by=person.id,
                changed_at=request.app.state.now(),
            )
        )
        row = find_loan(connection, loan_id)
        assert row is not None
        return loan_out(row, load_people(connection))


@router.delete("/{loan_id}", status_code=204)
def delete_loan(loan_id: str, request: Request, _person: CurrentPerson) -> Response:
    with transaction(request.app.state.engine) as connection:
        if find_loan(connection, loan_id) is None:
            raise _not_found()
        connection.execute(delete(payments).where(payments.c.loan_id == loan_id))
        connection.execute(delete(loans).where(loans.c.id == loan_id))
    return Response(status_code=204)


@router.post("/{loan_id}/payments", status_code=201)
def settle_installment(
    loan_id: str, payment: PaymentIn, request: Request, person: CurrentPerson
) -> PaymentOut:
    now = request.app.state.now()
    with transaction(request.app.state.engine) as connection:
        if find_loan(connection, loan_id) is None:
            raise _not_found()
        if find_payment(connection, loan_id, payment.installment_index):
            raise HTTPException(status_code=409, detail="Already settled.")
        connection.execute(
            payments.insert().values(
                loan_id=loan_id,
                **_payment_values(payment),
                added_by=person.id,
                added_at=now,
                changed_by=person.id,
                changed_at=now,
                settled_by=person.id,
                settled_at=now,
            )
        )
        row = find_payment(connection, loan_id, payment.installment_index)
        assert row is not None
        return payment_out(row, load_people(connection))
