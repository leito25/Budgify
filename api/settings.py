from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

NAMES = ("DATABASE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY")


class MissingSettingsError(RuntimeError):
    pass


@dataclass(frozen=True)
class Settings:
    database_url: str
    supabase_url: str
    supabase_publishable_key: str

    @classmethod
    def from_environment(cls, environment: Mapping[str, str]) -> Settings:
        missing = [name for name in NAMES if not environment.get(name, "").strip()]
        if missing:
            raise MissingSettingsError(f"Missing settings: {', '.join(missing)}")
        return cls(
            database_url=environment["DATABASE_URL"].strip(),
            supabase_url=environment["SUPABASE_URL"].strip().rstrip("/"),
            supabase_publishable_key=environment["SUPABASE_PUBLISHABLE_KEY"].strip(),
        )
