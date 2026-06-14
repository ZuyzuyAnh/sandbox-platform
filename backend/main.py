import asyncio
import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal, init_db
from routers.auth import router as auth_router
from routers.events import router as events_router
from routers.groups import router as groups_router
from routers.llmgw import router as llmgw_router
from routers.pool import router as pool_router
from routers.sessions import router as sessions_router
from routers.spawn import router as spawn_router
from routers.users import router as users_router
from services.sse_consumer import consume_loop
from services.state_poller import poll_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def _seed_defaults() -> None:
    from models.group import Group, UserGroup
    from models.user import User
    from services.auth_service import hash_password

    async with AsyncSessionLocal() as db:
        # Ensure default group exists
        result = await db.execute(select(Group).where(Group.name == "default"))
        default_group = result.scalar_one_or_none()
        if not default_group:
            default_group = Group(
                id=str(uuid.uuid4()),
                name="default",
                description="Default group — no egress permissions",
                network_policy={"defaultAction": "deny", "egress": []},
            )
            db.add(default_group)
            await db.flush()
            logger.info("Default group created")

        # Ensure at least one admin exists
        result = await db.execute(select(User).where(User.role == "admin"))
        if not result.scalar_one_or_none():
            admin = User(
                id=str(uuid.uuid4()),
                email=settings.admin_email,
                hashed_password=hash_password(settings.admin_password),
                role="admin",
            )
            db.add(admin)
            await db.flush()
            db.add(UserGroup(user_id=admin.id, group_id=default_group.id))
            logger.info("Admin user seeded: %s", settings.admin_email)

        await db.commit()

        # Seed built-in guardrail scenarios (only if none exist yet)
        from models.guardrail import GuardrailPolicy
        from services.guardrails import DEFAULT_POLICIES

        existing = await db.execute(select(GuardrailPolicy))
        if not existing.scalars().first():
            for p in DEFAULT_POLICIES:
                db.add(GuardrailPolicy(
                    name=p["name"], description=p["description"],
                    type=p["type"], config=p["config"],
                ))
            await db.commit()
            logger.info("Seeded %d default guardrail policies", len(DEFAULT_POLICIES))


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _seed_defaults()
    poller_task = asyncio.create_task(poll_loop())
    consumer_task = asyncio.create_task(consume_loop())
    yield
    poller_task.cancel()
    consumer_task.cancel()
    await asyncio.gather(poller_task, consumer_task, return_exceptions=True)


app = FastAPI(title="OpenSandbox Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list(),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(groups_router)
app.include_router(pool_router)
app.include_router(spawn_router)
app.include_router(events_router)
app.include_router(sessions_router)
app.include_router(llmgw_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
