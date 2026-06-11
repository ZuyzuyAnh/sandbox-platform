from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import settings


class Base(DeclarativeBase):
    pass


engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    import models.sandbox  # noqa: F401
    import models.event  # noqa: F401
    import models.session  # noqa: F401
    import models.user  # noqa: F401
    import models.group  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent migrations for columns added after initial table creation.
        await conn.execute(
            text("ALTER TABLE vscode_sessions ADD COLUMN IF NOT EXISTS user_id VARCHAR")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_limit INTEGER")
        )
        await conn.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_limit_window_minutes INTEGER")
        )
