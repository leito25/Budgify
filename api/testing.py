"""A test sign-in that needs no real password and never contacts Supabase.

Only tests and tests/e2e/server.py import this file. api/main.py must not,
and the Docker image leaves it out.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Request

from api.auth import Claims, InvalidTokenError

TEST_PASSWORD = "test-password"
TEST_PEOPLE: dict[str, Claims] = {
    "ana": Claims("test-person-ana", "ana@budgify.ng", "Ana Test"),
    "sam": Claims("test-person-sam", "sam@budgify.ng", None),
}
ACCESS_PREFIX = "test-access:"
REFRESH_PREFIX = "test-refresh:"
EXPIRED_PREFIX = "test-expired:"


def access_token(key: str) -> str:
    return f"{ACCESS_PREFIX}{key}"


class TestVerifier:
    __test__ = False  # not a pytest class

    def verify(self, token: str) -> Claims:
        prefix, _, key = token.partition(":")
        if f"{prefix}:" == ACCESS_PREFIX and key in TEST_PEOPLE:
            return TEST_PEOPLE[key]
        raise InvalidTokenError("Not a test token.")


def _session(key: str) -> dict[str, Any]:
    person = TEST_PEOPLE[key]
    return {
        "access_token": access_token(key),
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": f"{REFRESH_PREFIX}{key}",
        "user": {
            "id": person.person_id,
            "email": person.email,
            "user_metadata": {"full_name": person.name} if person.name else {},
        },
    }


def _invalid_credentials() -> HTTPException:
    return HTTPException(
        status_code=400,
        detail={
            "error_code": "invalid_credentials",
            "msg": "Invalid login credentials",
        },
    )


router = APIRouter(prefix="/auth/v1")


@router.post("/token")
async def token(request: Request, grant_type: str) -> dict[str, Any]:
    body = await request.json()
    if grant_type == "password":
        for key, person in TEST_PEOPLE.items():
            if (
                body.get("email") == person.email
                and body.get("password") == TEST_PASSWORD
            ):
                return _session(key)
    if grant_type == "refresh_token":
        key = str(body.get("refresh_token", "")).removeprefix(REFRESH_PREFIX)
        if key in TEST_PEOPLE:
            return _session(key)
    raise _invalid_credentials()
