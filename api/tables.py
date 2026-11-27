from sqlalchemy import (
    BigInteger,
    Column,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)

metadata = MetaData()

# Dates and timestamps are ISO text, so SQLite and Postgres read them the same way.
people = Table(
    "people",
    metadata,
    Column("id", String, primary_key=True),
    Column("email", String, nullable=False),
    Column("name", String),
    Column("updated_at", String, nullable=False),
)

workspace_settings = Table(
    "workspace_settings",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("region", String, nullable=False),
    Column("base_currency", String, nullable=False),
)


def _audit_columns() -> list[Column]:
    return [
        Column("added_by", String, ForeignKey("people.id"), nullable=False),
        Column("added_at", String, nullable=False),
        Column("changed_by", String, ForeignKey("people.id"), nullable=False),
        Column("changed_at", String, nullable=False),
    ]


loans = Table(
    "loans",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", Text, nullable=False),
    Column("description", Text, nullable=False),
    Column("principal_minor", BigInteger, nullable=False),
    Column("term_months", Integer, nullable=False),
    Column("rate", Float, nullable=False),
    Column("rate_basis", String, nullable=False),
    Column("interest_type", String, nullable=False),
    Column("penalty_rate_annual", Float, nullable=False),
    Column("first_due_date", String, nullable=False),
    *_audit_columns(),
)

payments = Table(
    "payments",
    metadata,
    Column("loan_id", String, ForeignKey("loans.id"), primary_key=True),
    Column("installment_index", Integer, primary_key=True),
    Column("paid_date", String, nullable=False),
    Column("scheduled_amount_minor", BigInteger, nullable=False),
    Column("penalty_minor", BigInteger, nullable=False),
    Column("total_paid_minor", BigInteger, nullable=False),
    *_audit_columns(),
    Column("settled_by", String, ForeignKey("people.id"), nullable=False),
    Column("settled_at", String, nullable=False),
)

income = Table(
    "income",
    metadata,
    Column("id", String, primary_key=True),
    Column("source", Text, nullable=False),
    Column("description", Text, nullable=False),
    Column("amount_minor", BigInteger, nullable=False),
    Column("date_received", String, nullable=False),
    Column("frequency", String, nullable=False),
    *_audit_columns(),
)
