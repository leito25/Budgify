from sqlalchemy import Connection, func, select

from api.schemas import SearchResult
from api.tables import income, loans

MAX_RESULTS = 20
# "!" rather than a backslash: its meaning does not depend on how the database
# treats backslashes in string literals, so SQLite and Postgres agree.
ESCAPE = "!"


def like_pattern(text: str) -> str:
    """Match the text anywhere, with %, _ and the escape character as plain characters."""
    escaped = text.lower().replace(ESCAPE, ESCAPE * 2)
    escaped = escaped.replace("%", f"{ESCAPE}%").replace("_", f"{ESCAPE}_")
    return f"%{escaped}%"


def search_workspace(connection: Connection, text: str) -> list[SearchResult]:
    query = text.strip()
    if not query:
        return []
    pattern = like_pattern(query)
    loan_rows = connection.execute(
        select(loans.c.id, loans.c.name)
        .where(func.lower(loans.c.name).like(pattern, escape=ESCAPE))
        .order_by(loans.c.name)
        .limit(MAX_RESULTS)
    )
    income_rows = connection.execute(
        select(income.c.id, income.c.source)
        .where(func.lower(income.c.source).like(pattern, escape=ESCAPE))
        .order_by(income.c.source)
        .limit(MAX_RESULTS)
    )
    return [
        *(SearchResult(kind="loan", id=row.id, name=row.name) for row in loan_rows),
        *(
            SearchResult(kind="income", id=row.id, name=row.source)
            for row in income_rows
        ),
    ]
