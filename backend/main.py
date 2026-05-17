import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers.events import router as events_router
from routers.pool import router as pool_router
from routers.sessions import router as sessions_router
from routers.spawn import router as spawn_router
from services.sse_consumer import consume_loop
from services.state_poller import poll_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
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

app.include_router(pool_router)
app.include_router(spawn_router)
app.include_router(events_router)
app.include_router(sessions_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}
