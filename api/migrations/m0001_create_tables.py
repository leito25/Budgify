from sqlalchemy import Connection

from api.tables import metadata


def upgrade(connection: Connection) -> None:
    metadata.create_all(connection)
