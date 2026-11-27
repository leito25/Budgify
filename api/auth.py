from collections.abc import Callable
from dataclasses import dataclass
from typing import Annotated, Any, Protocol

import jwt
from fastapi import Depends, Header, HTTPException, Request
from jwt import PyJWKClient
from sqlalchemy import Connection, Engine, select
from sqlalchemy.exc import IntegrityError

from api.db import transaction
from api.tables import people

SIGNING_ALGORITHMS = ["ES256", "RS256"]
AUDIENCE = "authenticated"


class InvalidTokenError(Exception):
    pass


@dataclass(frozen=True)
class Claims:
    person_id: str
    email: str
    name: str | None


@dataclass(frozen=True)
class Person:
    id: str
    email: str
    name: str | None


class TokenVerifier(Protocol):
    def verify(self, token: str) -> Claims: ...


KeyResolver = Callable[[str], Any]


def claims_from_payload(payload: dict[str, Any]) -> Claims:
    person_id = payload.get("sub")
    email = payload.get("email")
    if not isinstance(person_id, str) or not isinstance(email, str):
        raise InvalidTokenError("The token has no person.")
    metadata = payload.get("user_metadata") or {}
    name = metadata.get("full_name") or metadata.get("name")
    return Claims(person_id, email, name if isinstance(name, str) and name else None)


class SupabaseVerifier:
    """Checks a Supabase session token against the project's public keys."""

    def __init__(self, supabase_url: str, key_resolver: KeyResolver | None = None):
        self.issuer = f"{supabase_url.rstrip('/')}/auth/v1"
        self._resolve_key = key_resolver or self._fetch_key
        self._jwks = PyJWKClient(f"{self.issuer}/.well-known/jwks.json")

    def _fetch_key(self, token: str) -> Any:
        return self._jwks.get_signing_key_from_jwt(token).key

    def verify(self, token: str) -> Claims:
        try:
            payload = jwt.decode(
                token,
                self._resolve_key(token),
                algorithms=SIGNING_ALGORITHMS,
                audience=AUDIENCE,
                issuer=self.issuer,
                options={"require": ["exp", "sub", "iss", "aud"]},
            )
        except jwt.PyJWTError as error:
            raise InvalidTokenError(str(error)) from error
        return claims_from_payload(payload)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Sign in required.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def bearer_token(authorization: str | None) -> str:
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise _unauthorized()
    return token.strip()


def upsert_person(engine: Engine, claims: Claims, now: str) -> Person:
    """Record the person from their token, writing only when something changed."""
    person = Person(claims.person_id, claims.email, claims.name)
    with transaction(engine) as connection:
        if _save_changes(connection, person, now):
            return person
    # A concurrent first request inserted the same person; the retry updates it.
    with transaction(engine) as connection:
        _save_changes(connection, person, now)
    return person


def _save_changes(connection: Connection, person: Person, now: str) -> bool:
    row = connection.execute(
        select(people.c.email, people.c.name).where(people.c.id == person.id)
    ).first()
    try:
        if row is None:
            connection.execute(
                people.insert().values(
                    id=person.id, email=person.email, name=person.name, updated_at=now
                )
            )
        elif (row.email, row.name) != (person.email, person.name):
            connection.execute(
                people.update()
                .where(people.c.id == person.id)
                .values(email=person.email, name=person.name, updated_at=now)
            )
    except IntegrityError:
        return False
    return True


def current_person(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> Person:
    state = request.app.state
    try:
        claims = state.verifier.verify(bearer_token(authorization))
    except InvalidTokenError as error:
        raise _unauthorized() from error
    return upsert_person(state.engine, claims, state.now())


CurrentPerson = Annotated[Person, Depends(current_person)]
