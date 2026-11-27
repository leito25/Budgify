from fastapi import APIRouter

from api.auth import CurrentPerson
from api.schemas import MeOut

router = APIRouter(prefix="/api")


@router.get("/me")
def me(person: CurrentPerson) -> MeOut:
    return MeOut(id=person.id, email=person.email, name=person.name)
