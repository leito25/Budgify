from datetime import date
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel
from sqlalchemy import Row

from api.auth import Person

MAX_MINOR = 10**15
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Minor = Annotated[int, Field(ge=0, le=MAX_MINOR)]


class ApiModel(BaseModel):
    """Camel-case on the wire, to match the frontend's own field names."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PersonRef(ApiModel):
    id: str
    name: str | None
    email: str


class Audit(ApiModel):
    added_by: PersonRef
    added_at: str
    changed_by: PersonRef
    changed_at: str


class LoanIn(ApiModel):
    name: Name
    description: str = ""
    principal_minor: Annotated[int, Field(gt=0, le=MAX_MINOR)]
    term_months: Annotated[int, Field(gt=0, le=600)]
    rate: Annotated[float, Field(ge=0, le=100)]
    rate_basis: Literal["monthly_nominal", "effective_annual", "apr"]
    interest_type: Literal["simple", "compound"]
    penalty_rate_annual: Annotated[float, Field(ge=0, le=100)]
    first_due_date: date


class LoanOut(Audit):
    id: str
    name: str
    description: str
    principal_minor: int
    term_months: int
    rate: float
    rate_basis: str
    interest_type: str
    penalty_rate_annual: float
    first_due_date: str
    created_at: str


class PaymentIn(ApiModel):
    installment_index: Annotated[int, Field(ge=0, le=1000)]
    paid_date: date
    scheduled_amount_minor: Minor
    penalty_minor: Minor
    total_paid_minor: Minor


class PaymentOut(Audit):
    loan_id: str
    installment_index: int
    paid_date: str
    scheduled_amount_minor: int
    penalty_minor: int
    total_paid_minor: int
    settled_by: PersonRef
    settled_at: str


class IncomeIn(ApiModel):
    source: Name
    description: str = ""
    amount_minor: Minor
    date_received: date
    frequency: Literal["one_time", "recurring"]


class IncomeOut(Audit):
    id: str
    source: str
    description: str
    amount_minor: int
    date_received: str
    frequency: str


class WorkspaceOut(ApiModel):
    region: str
    base_currency: str
    loans: list[LoanOut]
    payments: list[PaymentOut]
    income: list[IncomeOut]


class MeOut(ApiModel):
    id: str
    email: str
    name: str | None


class SearchResult(ApiModel):
    kind: Literal["loan", "income"]
    id: str
    name: str


People = dict[str, PersonRef]


def person_ref(person: Person) -> PersonRef:
    return PersonRef(id=person.id, name=person.name, email=person.email)


def _audit(row: Row[Any], people: People) -> dict[str, Any]:
    return {
        "added_by": people[row.added_by],
        "added_at": row.added_at,
        "changed_by": people[row.changed_by],
        "changed_at": row.changed_at,
    }


def loan_out(row: Row[Any], people: People) -> LoanOut:
    return LoanOut(
        id=row.id,
        name=row.name,
        description=row.description,
        principal_minor=row.principal_minor,
        term_months=row.term_months,
        rate=row.rate,
        rate_basis=row.rate_basis,
        interest_type=row.interest_type,
        penalty_rate_annual=row.penalty_rate_annual,
        first_due_date=row.first_due_date,
        created_at=row.added_at,
        **_audit(row, people),
    )


def payment_out(row: Row[Any], people: People) -> PaymentOut:
    return PaymentOut(
        loan_id=row.loan_id,
        installment_index=row.installment_index,
        paid_date=row.paid_date,
        scheduled_amount_minor=row.scheduled_amount_minor,
        penalty_minor=row.penalty_minor,
        total_paid_minor=row.total_paid_minor,
        settled_by=people[row.settled_by],
        settled_at=row.settled_at,
        **_audit(row, people),
    )


def income_out(row: Row[Any], people: People) -> IncomeOut:
    return IncomeOut(
        id=row.id,
        source=row.source,
        description=row.description,
        amount_minor=row.amount_minor,
        date_received=row.date_received,
        frequency=row.frequency,
        **_audit(row, people),
    )
