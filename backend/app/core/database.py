from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import event
from app.core.config import settings


def get_engine_kwargs():
    """Get engine kwargs based on database type"""
    kwargs = {"echo": settings.DEBUG}

    if settings.is_sqlite:
        # SQLite-specific settings
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # PostgreSQL connection pool settings
        kwargs["pool_pre_ping"] = True

    return kwargs


# Use the async_database_url property which handles URL conversion
engine = create_async_engine(settings.async_database_url, **get_engine_kwargs())


# Enable foreign key support for SQLite
if settings.is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create all tables - useful for SQLite local development"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
