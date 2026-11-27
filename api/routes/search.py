from typing import Annotated

from fastapi import APIRouter, Query, Request

from api.auth import CurrentPerson
from api.db import transaction
from api.schemas import SearchResult
from api.search import search_workspace

router = APIRouter(prefix="/api")


@router.get("/search")
def search(
    request: Request,
    _person: CurrentPerson,
    q: Annotated[str, Query(max_length=100)] = "",
) -> list[SearchResult]:
    with transaction(request.app.state.engine) as connection:
        return search_workspace(connection, q)
