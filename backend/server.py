from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
try:
    from .music_library import MusicLibrary, make_router
except ImportError:
    from music_library import MusicLibrary, make_router

try:
    from motor.motor_asyncio import AsyncIOMotorClient
except ImportError:
    AsyncIOMotorClient = None


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url) if mongo_url and AsyncIOMotorClient else None
db = client[os.environ.get('DB_NAME', 'thismoment')] if client else None

app = FastAPI(title="This Moment Studio API")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class BookingCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str = Field(..., min_length=3, max_length=254)
    phone: str = Field(..., min_length=3, max_length=40)
    event_type: str = Field(..., min_length=1, max_length=80)
    event_date: str = Field(..., min_length=1, max_length=40)
    message: Optional[str] = Field(default="", max_length=2000)


class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    phone: str
    event_type: str
    event_date: str
    message: str = ""
    status: str = "new"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StatusCheckCreate(BaseModel):
    client_name: str


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "This Moment Studio API", "status": "live"}


@api_router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingCreate):
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured for booking storage")
    booking = Booking(**payload.model_dump())
    doc = booking.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    try:
        await db.bookings.insert_one(doc)
    except Exception as e:
        logger.exception("Failed to insert booking")
        raise HTTPException(status_code=500, detail="Could not save booking") from e
    logger.info("New booking received: %s <%s> — %s on %s",
                booking.name, booking.email, booking.event_type, booking.event_date)
    return booking


@api_router.get("/bookings", response_model=List[Booking])
async def list_bookings():
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured for booking storage")
    docs = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        if isinstance(d.get('created_at'), str):
            d['created_at'] = datetime.fromisoformat(d['created_at'])
    return docs


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured for status storage")
    status_obj = StatusCheck(**input.model_dump())
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    await db.status_checks.insert_one(doc)
    return status_obj


@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    if db is None:
        raise HTTPException(status_code=503, detail="MongoDB is not configured for status storage")
    docs = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    for d in docs:
        if isinstance(d.get('timestamp'), str):
            d['timestamp'] = datetime.fromisoformat(d['timestamp'])
    return docs


music_root = Path(os.environ.get("MUSIC_LIBRARY_ROOT", ROOT_DIR.parent / "MusicLibrary"))
app.include_router(make_router(MusicLibrary(music_root)), prefix="/api")
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


FRONTEND_BUILD_DIR = Path(os.environ.get("FRONTEND_BUILD_DIR", ROOT_DIR.parent / "frontend" / "build"))

if FRONTEND_BUILD_DIR.exists():
    static_dir = FRONTEND_BUILD_DIR / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        requested = (FRONTEND_BUILD_DIR / full_path).resolve()
        build_root = FRONTEND_BUILD_DIR.resolve()
        if requested.is_file() and requested.is_relative_to(build_root):
            return FileResponse(requested)
        return FileResponse(FRONTEND_BUILD_DIR / "index.html")


@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
