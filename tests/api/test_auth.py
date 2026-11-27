import time
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from sqlalchemy import Engine, select

from api.auth import InvalidTokenError, SupabaseVerifier
from api.tables import people

ISSUER = "https://test.supabase.invalid/auth/v1"
KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


def make_token(key: Any = KEY, **overrides: Any) -> str:
    payload = {
        "sub": "person-1",
        "email": "person@budgify.ng",
        "aud": "authenticated",
        "iss": ISSUER,
        "exp": int(time.time()) + 600,
        "user_metadata": {"full_name": "Pat Test"},
        **overrides,
    }
    return jwt.encode(payload, key, algorithm="ES256")


@pytest.fixture
def verifier() -> SupabaseVerifier:
    return SupabaseVerifier(
        "https://test.supabase.invalid", lambda _token: KEY.public_key()
    )


def test_a_valid_token_gives_the_person(verifier: SupabaseVerifier):
    claims = verifier.verify(make_token())
    assert (claims.person_id, claims.email, claims.name) == (
        "person-1",
        "person@budgify.ng",
        "Pat Test",
    )


@pytest.mark.parametrize(
    "token",
    [
        "not-a-token",
        make_token(exp=int(time.time()) - 10),
        make_token(iss="https://other.supabase.co/auth/v1"),
        make_token(aud="anon"),
        make_token(OTHER_KEY),
        make_token(sub=None),
        make_token(email=5),
    ],
    ids=[
        "garbage",
        "expired",
        "other project",
        "wrong audience",
        "wrong key",
        "no person",
        "no email",
    ],
)
def test_bad_tokens_are_refused(verifier: SupabaseVerifier, token: str):
    with pytest.raises(InvalidTokenError):
        verifier.verify(token)


@pytest.mark.parametrize(
    "headers",
    [
        {},
        {"Authorization": "Bearer"},
        {"Authorization": "Basic abc"},
        {"Authorization": "Bearer nope"},
    ],
    ids=["none", "empty", "wrong scheme", "bad token"],
)
def test_the_api_refuses_a_missing_or_bad_token(client, headers: dict[str, str]):
    response = client.get("/api/me", headers=headers)
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_the_person_comes_from_the_token_not_the_request(client, ana):
    response = client.get(
        "/api/me?email=evil@budgify.ng&id=x", headers={**ana, "X-Person": "sam"}
    )
    assert response.json() == {
        "id": "test-person-ana",
        "email": "ana@budgify.ng",
        "name": "Ana Test",
    }


def _ana_row(engine: Engine):
    with engine.connect() as connection:
        return connection.execute(
            select(people).where(people.c.id == "test-person-ana")
        ).one()


def test_the_person_row_is_created_and_updated(client, engine: Engine, ana, clock):
    client.get("/api/me", headers=ana)
    assert _ana_row(engine).name == "Ana Test"

    with engine.begin() as connection:
        connection.execute(
            people.update().where(people.c.id == "test-person-ana").values(name="Old")
        )
    clock.advance()
    client.get("/api/me", headers=ana)
    row = _ana_row(engine)
    assert row.name == "Ana Test"
    assert row.updated_at.startswith("2026-11-23T12:01")
