import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import delete

from api.auth import CurrentPerson
from api.db import transaction
from api.queries import find_income, load_people
from api.schemas import IncomeIn, IncomeOut, income_out
from api.tables import income

router = APIRouter(prefix="/api/income")


def _income_values(entry: IncomeIn) -> dict[str, object]:
    return {
        **entry.model_dump(exclude={"date_received"}),
        "date_received": entry.date_received.isoformat(),
    }


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Income entry not found.")


@router.post("", status_code=201)
def create_income(
    entry: IncomeIn, request: Request, person: CurrentPerson
) -> IncomeOut:
    now = request.app.state.now()
    income_id = str(uuid.uuid4())
    with transaction(request.app.state.engine) as connection:
        connection.execute(
            income.insert().values(
                id=income_id,
                **_income_values(entry),
                added_by=person.id,
                added_at=now,
                changed_by=person.id,
                changed_at=now,
            )
        )
        row = find_income(connection, income_id)
        assert row is not None
        return income_out(row, load_people(connection))


@router.put("/{income_id}")
def update_income(
    income_id: str, entry: IncomeIn, request: Request, person: CurrentPerson
) -> IncomeOut:
    with transaction(request.app.state.engine) as connection:
        if find_income(connection, income_id) is None:
            raise _not_found()
        connection.execute(
            income.update()
            .where(income.c.id == income_id)
            .values(
                **_income_values(entry),
                changed_by=person.id,
                changed_at=request.app.state.now(),
            )
        )
        row = find_income(connection, income_id)
        assert row is not None
        return income_out(row, load_people(connection))


@router.delete("/{income_id}", status_code=204)
def delete_income(income_id: str, request: Request, _person: CurrentPerson) -> Response:
    with transaction(request.app.state.engine) as connection:
        if find_income(connection, income_id) is None:
            raise _not_found()
        connection.execute(delete(income).where(income.c.id == income_id))
    return Response(status_code=204)
