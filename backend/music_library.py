from __future__ import annotations

import hashlib
import hmac
import gc
import json
import math
import os
import re
import tempfile
import shutil
import sqlite3
import threading
import traceback
import wave
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PureWindowsPath
from typing import Any, Literal, Optional

import requests
from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".flac"}
VALID_RATINGS = {"S", "A", "B", "C", "D"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def default_library_root() -> Path:
    configured = Path.cwd() / "MusicLibrary"
    return configured.resolve()


class MusicLibrary:
    def __init__(self, root: Path):
        self.root = root
        self.originals_dir = root / "Originals"
        self.library_dir = root / "Library"
        self.exports_dir = root / "Exports"
        self.data_dir = root / "Data"
        self.artwork_dir = self.data_dir / "Artwork"
        self.inbox_dir = root / "Inbox"
        self.db_path = self.data_dir / "music_library.sqlite3"

    def setup(self) -> None:
        for directory in (
            self.originals_dir,
            self.library_dir,
            self.exports_dir,
            self.data_dir,
            self.artwork_dir,
            self.inbox_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)
        self._migrate()
        self.repair_paths()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _migrate(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS tracks (
                    id TEXT PRIMARY KEY,
                    original_filename TEXT NOT NULL,
                    display_title TEXT NOT NULL,
                    original_filepath TEXT NOT NULL,
                    imported_filepath TEXT NOT NULL,
                    source_platform TEXT,
                    source_generation_id TEXT,
                    creation_date TEXT,
                    import_date TEXT NOT NULL,
                    generation_model_version TEXT,
                    full_generation_prompt TEXT,
                    negative_prompt TEXT,
                    lyrics TEXT,
                    cover_art_url TEXT,
                    cover_art_filepath TEXT,
                    duration_seconds REAL,
                    file_format TEXT NOT NULL,
                    sample_rate INTEGER,
                    bitrate INTEGER,
                    channels INTEGER,
                    file_size INTEGER NOT NULL,
                    file_hash TEXT NOT NULL UNIQUE,
                    rating TEXT CHECK (rating IN ('S', 'A', 'B', 'C', 'D') OR rating IS NULL),
                    favorite INTEGER NOT NULL DEFAULT 0,
                    note TEXT NOT NULL DEFAULT '',
                    listened INTEGER NOT NULL DEFAULT 0,
                    duplicate_of TEXT REFERENCES tracks(id),
                    duplicate_reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(rating);
                CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(favorite);
                CREATE INDEX IF NOT EXISTS idx_tracks_import_date ON tracks(import_date);
                CREATE INDEX IF NOT EXISTS idx_tracks_file_hash ON tracks(file_hash);

                CREATE TABLE IF NOT EXISTS notes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS tags (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    category TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS track_tags (
                    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (track_id, tag_id)
                );

                CREATE TABLE IF NOT EXISTS playlists (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    description TEXT NOT NULL DEFAULT '',
                    is_special INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS playlist_tracks (
                    playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
                    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                    position INTEGER NOT NULL,
                    main_problem TEXT NOT NULL DEFAULT '',
                    added_at TEXT NOT NULL,
                    PRIMARY KEY (playlist_id, track_id)
                );

                CREATE TABLE IF NOT EXISTS generation_metadata (
                    track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                    raw_metadata_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS analysis_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
                    analysis_type TEXT NOT NULL,
                    result_json TEXT NOT NULL,
                    model_version TEXT,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS track_analysis (
                    track_id TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
                    bpm REAL,
                    musical_key TEXT,
                    energy REAL,
                    energy_label TEXT,
                    danceability REAL,
                    vocal_score REAL,
                    loudness REAL,
                    intro_end REAL,
                    outro_start REAL,
                    beat_interval REAL,
                    first_beat REAL,
                    beat_confidence REAL,
                    drop_times_json TEXT NOT NULL DEFAULT '[]',
                    breakdown_times_json TEXT NOT NULL DEFAULT '[]',
                    status TEXT NOT NULL DEFAULT 'pending',
                    error TEXT NOT NULL DEFAULT '',
                    analysis_version TEXT NOT NULL DEFAULT 'analysis-v1',
                    updated_at TEXT NOT NULL
                );
                """
            )
            ensure_column(conn, "tracks", "cover_art_url", "TEXT")
            ensure_column(conn, "tracks", "cover_art_filepath", "TEXT")
            ensure_column(conn, "track_analysis", "beat_interval", "REAL")
            ensure_column(conn, "track_analysis", "first_beat", "REAL")
            ensure_column(conn, "track_analysis", "beat_confidence", "REAL")

    def repair_paths(self) -> None:
        if not self.db_path.exists():
            return
        with self.connect() as conn:
            rows = conn.execute("SELECT id, imported_filepath, cover_art_filepath FROM tracks").fetchall()
            for row in rows:
                updates: list[str] = []
                params: list[Any] = []

                imported_filepath = row["imported_filepath"]
                imported_path = Path(imported_filepath)
                if imported_filepath and not imported_path.exists():
                    candidate = self.originals_dir / portable_path_name(imported_filepath)
                    if candidate.exists():
                        updates.append("imported_filepath = ?")
                        params.append(str(candidate))

                cover_art_filepath = row["cover_art_filepath"]
                if cover_art_filepath:
                    artwork_path = Path(cover_art_filepath)
                    if not artwork_path.exists():
                        candidate = self.artwork_dir / portable_path_name(cover_art_filepath)
                        if candidate.exists():
                            updates.append("cover_art_filepath = ?")
                            params.append(str(candidate))

                if updates:
                    updates.append("updated_at = ?")
                    params.extend([utc_now(), row["id"]])
                    conn.execute(f"UPDATE tracks SET {', '.join(updates)} WHERE id = ?", params)

    def next_track_id(self, conn: sqlite3.Connection) -> str:
        rows = conn.execute("SELECT id FROM tracks WHERE id LIKE 'T____'").fetchall()
        highest = 0
        for row in rows:
            try:
                highest = max(highest, int(row["id"][1:]))
            except ValueError:
                continue
        return f"T{highest + 1:04d}"


class ImportRequest(BaseModel):
    inbox_path: Optional[str] = Field(default=None)


class TrackUpdate(BaseModel):
    display_title: Optional[str] = None
    source_platform: Optional[str] = None
    source_generation_id: Optional[str] = None
    creation_date: Optional[str] = None
    generation_model_version: Optional[str] = None
    full_generation_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    lyrics: Optional[str] = None
    cover_art_url: Optional[str] = None
    rating: Optional[str] = None
    favorite: Optional[bool] = None
    note: Optional[str] = None
    listened: Optional[bool] = None


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)


class PlaylistTrackRequest(BaseModel):
    track_id: str = Field(min_length=1)


class AnalysisRunRequest(BaseModel):
    limit: int = Field(default=25, ge=1, le=250)
    force: bool = False
    mode: Literal["audio", "metadata"] = "audio"


class RestoreRequest(BaseModel):
    url: str = Field(min_length=8)
    token: str = Field(min_length=12)
    expected_sha256: Optional[str] = None


class RestoreChunkFinishRequest(BaseModel):
    token: str = Field(min_length=12)
    total_parts: int = Field(ge=1, le=10000)
    expected_sha256: str = Field(min_length=64, max_length=64)


class SunoIngestRequest(BaseModel):
    token: str = Field(min_length=12)
    audio_url: str = Field(min_length=8)
    title: Optional[str] = Field(default=None, max_length=200)
    generation_id: Optional[str] = Field(default=None, max_length=160)
    artwork_url: Optional[str] = Field(default=None, max_length=1000)
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    lyrics: Optional[str] = None
    model_version: Optional[str] = Field(default=None, max_length=120)
    creation_date: Optional[str] = Field(default=None, max_length=120)
    playlist_name: str = Field(default="Fresh Suno", min_length=1, max_length=80)
    raw_metadata: dict[str, Any] = Field(default_factory=dict)


def make_router(library: MusicLibrary) -> APIRouter:
    router = APIRouter(prefix="/music", tags=["music-library"])

    @router.get("/config")
    async def get_config() -> dict[str, str]:
        library.setup()
        return {
            "library_root": str(library.root),
            "inbox_path": str(library.inbox_dir),
            "database_path": str(library.db_path),
            "originals_path": str(library.originals_dir),
            "artwork_path": str(library.artwork_dir),
        }

    @router.post("/restore")
    async def restore_library(payload: RestoreRequest) -> dict[str, Any]:
        restore_token = os.environ.get("MUSIC_RESTORE_TOKEN")
        if not restore_token:
            raise HTTPException(status_code=503, detail="Restore is disabled until MUSIC_RESTORE_TOKEN is configured")
        if not secrets_equal(payload.token, restore_token):
            raise HTTPException(status_code=403, detail="Invalid restore token")

        library.root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as temp_dir:
            archive_path = Path(temp_dir) / "music-library-backup.zip"
            digest = hashlib.sha256()
            try:
                with requests.get(payload.url, stream=True, timeout=(15, 120)) as response:
                    response.raise_for_status()
                    with archive_path.open("wb") as handle:
                        for chunk in response.iter_content(chunk_size=1024 * 1024):
                            if chunk:
                                digest.update(chunk)
                                handle.write(chunk)
            except requests.RequestException as exc:
                raise HTTPException(status_code=400, detail=f"Could not download backup: {exc}") from exc

            actual_sha256 = digest.hexdigest()
            if payload.expected_sha256 and payload.expected_sha256.lower() != actual_sha256:
                raise HTTPException(status_code=400, detail="Backup checksum did not match")

            staging_dir = Path(temp_dir) / "restore"
            staging_dir.mkdir()
            try:
                with zipfile.ZipFile(archive_path) as archive:
                    safe_extract_zip(archive, staging_dir)
            except zipfile.BadZipFile as exc:
                raise HTTPException(status_code=400, detail="Backup is not a valid zip file") from exc

            source_root = staging_dir / "MusicLibrary"
            if not source_root.exists():
                source_root = staging_dir
            if not (source_root / "Data" / "music_library.sqlite3").exists():
                raise HTTPException(status_code=400, detail="Backup does not contain Data/music_library.sqlite3")

            backup_dir = library.root.with_name(f"{library.root.name}.previous-restore")
            if backup_dir.exists():
                shutil.rmtree(backup_dir)
            if library.root.exists() and any(library.root.iterdir()):
                library.root.rename(backup_dir)
            library.root.mkdir(parents=True, exist_ok=True)

            for item in source_root.iterdir():
                destination = library.root / item.name
                if item.is_dir():
                    shutil.copytree(item, destination)
                else:
                    shutil.copy2(item, destination)

        library.setup()
        with library.connect() as conn:
            stats = library_stats(conn)
        return {"restored": True, "sha256": actual_sha256, "stats": stats}

    @router.put("/restore/chunks/{session_id}/{part_index}")
    async def upload_restore_chunk(session_id: str, part_index: int, request: Request) -> dict[str, Any]:
        restore_token = os.environ.get("MUSIC_RESTORE_TOKEN")
        provided_token = request.headers.get("x-music-restore-token", "")
        if not restore_token:
            raise HTTPException(status_code=503, detail="Restore is disabled until MUSIC_RESTORE_TOKEN is configured")
        if not secrets_equal(provided_token, restore_token):
            raise HTTPException(status_code=403, detail="Invalid restore token")
        if not safe_restore_session_id(session_id):
            raise HTTPException(status_code=400, detail="Invalid restore session")
        if part_index < 0:
            raise HTTPException(status_code=400, detail="Invalid part index")

        upload_dir = restore_upload_dir(library, session_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        part_path = upload_dir / f"{part_index:06d}.part"
        bytes_written = 0
        with part_path.open("wb") as handle:
            async for chunk in request.stream():
                if chunk:
                    bytes_written += len(chunk)
                    handle.write(chunk)
        return {"uploaded": True, "session_id": session_id, "part_index": part_index, "bytes": bytes_written}

    @router.post("/restore/chunks/{session_id}/finish")
    async def finish_restore_chunks(session_id: str, payload: RestoreChunkFinishRequest) -> dict[str, Any]:
        restore_token = os.environ.get("MUSIC_RESTORE_TOKEN")
        if not restore_token:
            raise HTTPException(status_code=503, detail="Restore is disabled until MUSIC_RESTORE_TOKEN is configured")
        if not secrets_equal(payload.token, restore_token):
            raise HTTPException(status_code=403, detail="Invalid restore token")
        if not safe_restore_session_id(session_id):
            raise HTTPException(status_code=400, detail="Invalid restore session")

        upload_dir = restore_upload_dir(library, session_id)
        if not upload_dir.exists():
            raise HTTPException(status_code=400, detail="Restore session was not found")

        status = read_restore_status(upload_dir)
        if status.get("state") == "running":
            return {"accepted": True, "session_id": session_id, "status": status}

        write_restore_status(upload_dir, {"state": "queued", "message": "Restore job queued"})
        thread = threading.Thread(
            target=run_chunk_restore_job,
            args=(library, upload_dir, payload.total_parts, payload.expected_sha256.lower()),
            daemon=True,
        )
        thread.start()
        return {
            "accepted": True,
            "session_id": session_id,
            "status_url": f"/api/music/restore/chunks/{session_id}/status",
        }

    @router.get("/restore/chunks/{session_id}/status")
    async def get_restore_chunk_status(session_id: str, token: str = Query(min_length=12)) -> dict[str, Any]:
        restore_token = os.environ.get("MUSIC_RESTORE_TOKEN")
        if not restore_token:
            raise HTTPException(status_code=503, detail="Restore is disabled until MUSIC_RESTORE_TOKEN is configured")
        if not secrets_equal(token, restore_token):
            raise HTTPException(status_code=403, detail="Invalid restore token")
        if not safe_restore_session_id(session_id):
            raise HTTPException(status_code=400, detail="Invalid restore session")

        upload_dir = restore_upload_dir(library, session_id)
        if not upload_dir.exists():
            raise HTTPException(status_code=404, detail="Restore session was not found")
        return read_restore_status(upload_dir)

    @router.post("/suno/ingest")
    async def ingest_suno_track(payload: SunoIngestRequest) -> dict[str, Any]:
        ingest_token = os.environ.get("SUNO_INGEST_TOKEN") or os.environ.get("MUSIC_RESTORE_TOKEN")
        if not ingest_token:
            raise HTTPException(status_code=503, detail="Suno ingest is disabled until SUNO_INGEST_TOKEN is configured")
        if not secrets_equal(payload.token, ingest_token):
            raise HTTPException(status_code=403, detail="Invalid Suno ingest token")

        library.setup()
        track, duplicate = ingest_external_track(library, payload)
        return {"imported": track, "duplicate": duplicate}

    @router.post("/suno/upload")
    async def upload_suno_track(
        token: str = Form(min_length=12),
        metadata_json: str = Form(default="{}"),
        audio: UploadFile = File(),
        artwork: Optional[UploadFile] = File(default=None),
    ) -> dict[str, Any]:
        ingest_token = os.environ.get("SUNO_INGEST_TOKEN") or os.environ.get("MUSIC_RESTORE_TOKEN")
        if not ingest_token:
            raise HTTPException(status_code=503, detail="Suno ingest is disabled until SUNO_INGEST_TOKEN is configured")
        if not secrets_equal(token, ingest_token):
            raise HTTPException(status_code=403, detail="Invalid Suno ingest token")

        library.setup()
        try:
            metadata = json.loads(metadata_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="metadata_json must be valid JSON") from exc
        if not isinstance(metadata, dict):
            raise HTTPException(status_code=400, detail="metadata_json must be a JSON object")

        audio_path = save_upload_file(audio, library.inbox_dir / "Suno Auto Uploads", metadata.get("title") or audio.filename)
        artwork_path = None
        if artwork and artwork.filename:
            artwork_path = save_upload_file(
                artwork,
                library.artwork_dir,
                metadata.get("generation_id") or metadata.get("id") or artwork.filename,
                allowed_extensions={".jpg", ".jpeg", ".png", ".webp"},
            )

        payload = SunoIngestRequest(
            token=token,
            audio_url=f"upload://{audio.filename or audio_path.name}",
            title=metadata.get("title") or metadata.get("display_title"),
            generation_id=metadata.get("generation_id") or metadata.get("id"),
            artwork_url=metadata.get("artwork_url") or metadata.get("image_url"),
            prompt=metadata.get("prompt") or metadata.get("full_generation_prompt"),
            negative_prompt=metadata.get("negative_prompt"),
            lyrics=metadata.get("lyrics"),
            model_version=metadata.get("model_version") or metadata.get("generation_model_version"),
            creation_date=metadata.get("creation_date") or metadata.get("created_at"),
            playlist_name=metadata.get("playlist_name") or "Fresh Suno",
            raw_metadata=metadata,
        )
        track, duplicate = ingest_downloaded_track(library, payload, audio_path, artwork_path)
        return {"imported": track, "duplicate": duplicate}

    @router.post("/suno/webhook/{provider}")
    async def receive_suno_webhook(provider: str, request: Request, secret: Optional[str] = Query(default=None)) -> dict[str, Any]:
        webhook_secret = (
            os.environ.get("SUNO_WEBHOOK_SECRET")
            or os.environ.get("SUNO_INGEST_TOKEN")
            or os.environ.get("MUSIC_RESTORE_TOKEN")
        )
        if not webhook_secret:
            raise HTTPException(status_code=503, detail="Suno webhook is disabled until SUNO_WEBHOOK_SECRET is configured")

        provided_secret = (
            secret
            or request.headers.get("x-suno-webhook-secret")
            or request.headers.get("x-webhook-secret")
            or request.headers.get("x-api-secret")
            or ""
        )
        if not secrets_equal(provided_secret, webhook_secret):
            raise HTTPException(status_code=403, detail="Invalid Suno webhook secret")

        payload = await request.json()
        if not isinstance(payload, dict):
            raise HTTPException(status_code=400, detail="Webhook payload must be a JSON object")

        library.setup()
        imported: list[dict[str, Any]] = []
        duplicates: list[dict[str, Any]] = []
        for index, item in enumerate(extract_provider_tracks(payload)):
            audio_url = item.get("audio_url") or item.get("download_url") or item.get("source_audio_url")
            if not audio_url:
                continue
            ingest_payload = SunoIngestRequest(
                token=webhook_secret,
                audio_url=audio_url,
                title=item.get("title") or item.get("name"),
                generation_id=item.get("id") or item.get("audio_id") or item.get("clip_id") or f"{provider}-{index}",
                artwork_url=item.get("image_url") or item.get("cover_url") or item.get("artwork_url"),
                prompt=item.get("prompt") or payload.get("prompt"),
                negative_prompt=item.get("negative_prompt") or payload.get("negative_prompt"),
                lyrics=item.get("lyrics") or payload.get("lyrics"),
                model_version=item.get("model") or payload.get("model"),
                creation_date=str(item.get("createTime") or item.get("created_at") or payload.get("createTime") or ""),
                playlist_name="Fresh Suno",
                raw_metadata={"provider": provider, "webhook": payload, "track": item},
            )
            track, duplicate = ingest_external_track(library, ingest_payload)
            imported.append(track)
            if duplicate:
                duplicates.append(track)

        return {"provider": provider, "received": True, "imported": imported, "duplicates": duplicates}

    @router.post("/import")
    async def import_audio(payload: ImportRequest) -> dict[str, Any]:
        library.setup()
        inbox = Path(payload.inbox_path).expanduser().resolve() if payload.inbox_path else library.inbox_dir
        if not inbox.exists() or not inbox.is_dir():
            raise HTTPException(status_code=400, detail=f"Inbox folder does not exist: {inbox}")

        files = sorted(
            path for path in inbox.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTENSIONS
        )
        imported: list[dict[str, Any]] = []
        duplicates: list[dict[str, Any]] = []

        with library.connect() as conn:
            for path in files:
                file_hash = sha256_file(path)
                stat = path.stat()
                existing = conn.execute(
                    "SELECT id, original_filename, imported_filepath FROM tracks WHERE file_hash = ?",
                    (file_hash,),
                ).fetchone()
                if existing:
                    duplicates.append(
                        {
                            "filename": path.name,
                            "filepath": str(path),
                            "duplicate_of": existing["id"],
                            "reason": "sha256 hash match",
                        }
                    )
                    continue

                metadata = audio_metadata(path, stat.st_size)
                track_id = library.next_track_id(conn)
                imported_path = unique_import_path(library.originals_dir, track_id, path.suffix.lower())
                shutil.copy2(path, imported_path)
                now = utc_now()
                title = path.stem.replace("_", " ").replace("-", " ").strip() or track_id

                conn.execute(
                    """
                    INSERT INTO tracks (
                        id, original_filename, display_title, original_filepath, imported_filepath,
                        import_date, duration_seconds, file_format, sample_rate, bitrate, channels,
                        file_size, file_hash, created_at, updated_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        track_id,
                        path.name,
                        title,
                        str(path),
                        str(imported_path),
                        now,
                        metadata["duration_seconds"],
                        path.suffix.lower().lstrip("."),
                        metadata["sample_rate"],
                        metadata["bitrate"],
                        metadata["channels"],
                        stat.st_size,
                        file_hash,
                        now,
                        now,
                    ),
                )
                imported.append(track_to_dict(get_track(conn, track_id)))

        return {
            "scanned": len(files),
            "imported": imported,
            "duplicates": duplicates,
            "library_root": str(library.root),
        }

    @router.get("/playlists")
    async def list_playlists() -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            rows = conn.execute("SELECT * FROM playlists ORDER BY name COLLATE NOCASE ASC").fetchall()
            playlists = [playlist_to_dict(conn, row) for row in rows]
        return {"playlists": playlists}

    @router.post("/playlists")
    async def create_playlist(payload: PlaylistCreate) -> dict[str, Any]:
        library.setup()
        now = utc_now()
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Playlist name is required")
        with library.connect() as conn:
            try:
                cursor = conn.execute(
                    """
                    INSERT INTO playlists (name, description, created_at, updated_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (name, payload.description.strip(), now, now),
                )
            except sqlite3.IntegrityError:
                raise HTTPException(status_code=409, detail="A playlist with that name already exists") from None
            row = conn.execute("SELECT * FROM playlists WHERE id = ?", (cursor.lastrowid,)).fetchone()
            return playlist_to_dict(conn, row)

    @router.delete("/playlists/{playlist_id}")
    async def delete_playlist(playlist_id: int) -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            row = conn.execute("SELECT id, name FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")
            conn.execute("DELETE FROM playlists WHERE id = ?", (playlist_id,))
        return {"deleted": True, "id": playlist_id, "name": row["name"]}

    @router.post("/playlists/{playlist_id}/tracks")
    async def add_playlist_track(playlist_id: int, payload: PlaylistTrackRequest) -> dict[str, Any]:
        library.setup()
        now = utc_now()
        with library.connect() as conn:
            playlist = conn.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
            if not playlist:
                raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")
            get_track(conn, payload.track_id)
            existing = conn.execute(
                "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
                (playlist_id, payload.track_id),
            ).fetchone()
            if not existing:
                position = conn.execute(
                    "SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM playlist_tracks WHERE playlist_id = ?",
                    (playlist_id,),
                ).fetchone()["next_position"]
                conn.execute(
                    """
                    INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at)
                    VALUES (?, ?, ?, ?)
                    """,
                    (playlist_id, payload.track_id, position, now),
                )
                conn.execute("UPDATE playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))
            return playlist_to_dict(conn, playlist)

    @router.delete("/playlists/{playlist_id}/tracks/{track_id}")
    async def remove_playlist_track(playlist_id: int, track_id: str) -> dict[str, Any]:
        library.setup()
        now = utc_now()
        with library.connect() as conn:
            playlist = conn.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,)).fetchone()
            if not playlist:
                raise HTTPException(status_code=404, detail=f"Playlist not found: {playlist_id}")
            conn.execute("DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?", (playlist_id, track_id))
            resequence_playlist(conn, playlist_id)
            conn.execute("UPDATE playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))
            return playlist_to_dict(conn, playlist)

    @router.get("/tracks")
    async def list_tracks(
        rating: Optional[str] = None,
        favorite: Optional[bool] = None,
        unrated: bool = False,
        query: str = "",
        sort: str = Query(default="id", pattern="^(id|title|import_date|rating|duration|bpm|energy)$"),
    ) -> dict[str, Any]:
        library.setup()
        clauses: list[str] = []
        params: list[Any] = []
        if rating:
            clauses.append("tracks.rating = ?")
            params.append(rating.upper())
        if favorite is not None:
            clauses.append("tracks.favorite = ?")
            params.append(1 if favorite else 0)
        if unrated:
            clauses.append("tracks.rating IS NULL")
        if query:
            clauses.append("(tracks.display_title LIKE ? OR tracks.original_filename LIKE ? OR tracks.id LIKE ? OR tracks.note LIKE ?)")
            like = f"%{query}%"
            params.extend([like, like, like, like])

        order_by = {
            "id": "tracks.id ASC",
            "title": "tracks.display_title COLLATE NOCASE ASC",
            "import_date": "tracks.import_date DESC",
            "rating": "tracks.rating IS NULL, tracks.rating ASC, tracks.id ASC",
            "duration": "tracks.duration_seconds IS NULL, tracks.duration_seconds ASC",
            "bpm": "track_analysis.bpm IS NULL, track_analysis.bpm ASC, tracks.id ASC",
            "energy": "track_analysis.energy IS NULL, track_analysis.energy DESC, tracks.id ASC",
        }[sort]
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"""
            SELECT tracks.*, {analysis_select_columns()}
            FROM tracks
            LEFT JOIN track_analysis ON track_analysis.track_id = tracks.id
            {where}
            ORDER BY {order_by}
        """
        with library.connect() as conn:
            tracks = [track_to_dict(row) for row in conn.execute(sql, params).fetchall()]
            stats = library_stats(conn)
        return {"tracks": tracks, "stats": stats}

    @router.get("/tracks/{track_id}")
    async def read_track(track_id: str) -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            row = conn.execute(
                f"""
                SELECT tracks.*, {analysis_select_columns()}
                FROM tracks
                LEFT JOIN track_analysis ON track_analysis.track_id = tracks.id
                WHERE tracks.id = ?
                """,
                (track_id,),
            ).fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"Track not found: {track_id}")
            return track_to_dict(row)

    @router.post("/tracks/{track_id}/analysis")
    async def analyze_track_endpoint(track_id: str, force: bool = False) -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            track = get_track(conn, track_id)
            existing = conn.execute("SELECT * FROM track_analysis WHERE track_id = ?", (track_id,)).fetchone()
            if existing and not force and existing["status"] in {"described", "estimated", "complete"}:
                return {"track_id": track_id, "analysis": analysis_to_dict(existing), "cached": True}
            analysis = analyze_track(library, track, use_audio=True)
            save_track_analysis(conn, analysis)
            row = conn.execute("SELECT * FROM track_analysis WHERE track_id = ?", (track_id,)).fetchone()
            return {"track_id": track_id, "analysis": analysis_to_dict(row), "cached": False}

    @router.post("/analysis/run")
    async def run_analysis(payload: AnalysisRunRequest) -> dict[str, Any]:
        library.setup()
        analyzed: list[dict[str, Any]] = []
        skipped = 0
        if payload.force and payload.mode == "metadata":
            analysis_where = "track_analysis.track_id IS NULL OR track_analysis.status != 'complete' OR track_analysis.beat_interval IS NULL"
        elif payload.force:
            analysis_where = "1 = 1"
        elif payload.mode == "audio":
            analysis_where = "track_analysis.track_id IS NULL OR track_analysis.status IN ('error', 'estimated')"
        else:
            analysis_where = "track_analysis.track_id IS NULL OR track_analysis.status = 'error' OR track_analysis.beat_interval IS NULL"
        effective_limit = min(payload.limit, 5) if payload.mode == "audio" else payload.limit
        with library.connect() as conn:
            rows = conn.execute(
                f"""
                SELECT tracks.*
                FROM tracks
                LEFT JOIN track_analysis ON track_analysis.track_id = tracks.id
                WHERE {analysis_where}
                ORDER BY tracks.id ASC
                LIMIT ?
                """,
                (effective_limit,),
            ).fetchall()
            skipped = conn.execute("SELECT COUNT(*) AS count FROM tracks").fetchone()["count"] - len(rows)
            for track in rows:
                analysis = analyze_track(library, track, use_audio=payload.mode == "audio")
                save_track_analysis(conn, analysis)
                analyzed.append(
                    {
                        "track_id": track["id"],
                        "status": analysis["status"],
                        "bpm": analysis["bpm"],
                        "energy_label": analysis["energy_label"],
                    }
                )
        return {"analyzed": analyzed, "count": len(analyzed), "skipped_or_already_analyzed": max(0, skipped)}

    @router.patch("/tracks/{track_id}")
    async def update_track(track_id: str, payload: TrackUpdate) -> dict[str, Any]:
        library.setup()
        updates: list[str] = []
        params: list[Any] = []
        if payload.display_title is not None:
            updates.append("display_title = ?")
            params.append(payload.display_title.strip() or track_id)
        editable_text_fields = {
            "source_platform": 80,
            "source_generation_id": 180,
            "creation_date": 80,
            "generation_model_version": 120,
            "full_generation_prompt": 12000,
            "negative_prompt": 4000,
            "lyrics": 12000,
            "cover_art_url": 1000,
        }
        for field_name, max_length in editable_text_fields.items():
            value = getattr(payload, field_name)
            if value is not None:
                updates.append(f"{field_name} = ?")
                cleaned_value = value.strip()
                params.append(cleaned_value[:max_length] if cleaned_value else None)
        if payload.rating is not None:
            rating = payload.rating.upper().strip()
            if rating not in VALID_RATINGS:
                raise HTTPException(status_code=400, detail="Rating must be one of S, A, B, C, or D")
            updates.append("rating = ?")
            updates.append("listened = 1")
            params.append(rating)
        if payload.favorite is not None:
            updates.append("favorite = ?")
            params.append(1 if payload.favorite else 0)
        if payload.note is not None:
            updates.append("note = ?")
            params.append(payload.note[:1000])
        if payload.listened is not None:
            updates.append("listened = ?")
            params.append(1 if payload.listened else 0)
        if not updates:
            raise HTTPException(status_code=400, detail="No supported updates provided")

        updates.append("updated_at = ?")
        params.append(utc_now())
        params.append(track_id)

        with library.connect() as conn:
            get_track(conn, track_id)
            conn.execute(f"UPDATE tracks SET {', '.join(updates)} WHERE id = ?", params)
            if payload.note:
                conn.execute(
                    "INSERT INTO notes (track_id, body, created_at) VALUES (?, ?, ?)",
                    (track_id, payload.note[:1000], utc_now()),
                )
            return track_to_dict(get_track(conn, track_id))

    @router.delete("/tracks/{track_id}")
    async def delete_track(track_id: str) -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            row = get_track(conn, track_id)
            imported_path = Path(row["imported_filepath"])
            artwork_path = Path(row["cover_art_filepath"]) if row["cover_art_filepath"] else None
            conn.execute("DELETE FROM tracks WHERE id = ?", (track_id,))

        deleted_files = []
        for path in (imported_path, artwork_path):
            if path and path.exists() and is_relative_to(path.resolve(), library.root):
                path.unlink()
                deleted_files.append(str(path))

        return {
            "deleted": True,
            "id": track_id,
            "deleted_files": deleted_files,
        }

    @router.get("/tracks/{track_id}/audio")
    async def stream_audio(track_id: str) -> FileResponse:
        library.setup()
        with library.connect() as conn:
            row = get_track(conn, track_id)
        path = Path(row["imported_filepath"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="Imported audio file is missing")
        return FileResponse(path, filename=row["original_filename"], media_type=media_type_for(path))

    @router.get("/tracks/{track_id}/artwork")
    async def artwork(track_id: str) -> FileResponse:
        library.setup()
        with library.connect() as conn:
            row = get_track(conn, track_id)
        filepath = row["cover_art_filepath"] if "cover_art_filepath" in row.keys() else None
        if not filepath:
            raise HTTPException(status_code=404, detail="Track artwork is not available")
        path = Path(filepath)
        if not path.exists():
            raise HTTPException(status_code=404, detail="Track artwork file is missing")
        return FileResponse(path, media_type=image_media_type_for(path))

    return router


ANALYSIS_VERSION = "analysis-v1"


def analysis_select_columns() -> str:
    return """
        track_analysis.bpm AS analysis_bpm,
        track_analysis.musical_key AS analysis_musical_key,
        track_analysis.energy AS analysis_energy,
        track_analysis.energy_label AS analysis_energy_label,
        track_analysis.danceability AS analysis_danceability,
        track_analysis.vocal_score AS analysis_vocal_score,
        track_analysis.loudness AS analysis_loudness,
        track_analysis.intro_end AS analysis_intro_end,
        track_analysis.outro_start AS analysis_outro_start,
        track_analysis.beat_interval AS analysis_beat_interval,
        track_analysis.first_beat AS analysis_first_beat,
        track_analysis.beat_confidence AS analysis_beat_confidence,
        track_analysis.drop_times_json AS analysis_drop_times_json,
        track_analysis.breakdown_times_json AS analysis_breakdown_times_json,
        track_analysis.status AS analysis_status,
        track_analysis.error AS analysis_error,
        track_analysis.analysis_version AS analysis_version,
        track_analysis.updated_at AS analysis_updated_at
    """


def get_track(conn: sqlite3.Connection, track_id: str) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"Track not found: {track_id}")
    return row


def analysis_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if not row:
        return None
    data = dict(row)
    return {
        "bpm": data.get("bpm") or data.get("analysis_bpm"),
        "key": data.get("musical_key") or data.get("analysis_musical_key"),
        "energy": data.get("energy") or data.get("analysis_energy"),
        "energy_label": data.get("energy_label") or data.get("analysis_energy_label"),
        "danceability": data.get("danceability") or data.get("analysis_danceability"),
        "vocal_score": data.get("vocal_score") or data.get("analysis_vocal_score"),
        "loudness": data.get("loudness") or data.get("analysis_loudness"),
        "intro_end": data.get("intro_end") or data.get("analysis_intro_end"),
        "outro_start": data.get("outro_start") or data.get("analysis_outro_start"),
        "beat_interval": data.get("beat_interval") or data.get("analysis_beat_interval"),
        "first_beat": data.get("first_beat") or data.get("analysis_first_beat"),
        "beat_confidence": data.get("beat_confidence") or data.get("analysis_beat_confidence"),
        "drop_times": parse_json_list(data.get("drop_times_json") or data.get("analysis_drop_times_json")),
        "breakdown_times": parse_json_list(data.get("breakdown_times_json") or data.get("analysis_breakdown_times_json")),
        "status": data.get("status") or data.get("analysis_status"),
        "error": data.get("error") or data.get("analysis_error") or "",
        "analysis_version": data.get("analysis_version"),
        "updated_at": data.get("updated_at") or data.get("analysis_updated_at"),
    }


def parse_json_list(value: Any) -> list[Any]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, json.JSONDecodeError):
        return []


def track_analysis_from_joined_row(row: sqlite3.Row) -> dict[str, Any] | None:
    data = dict(row)
    if "analysis_status" not in data or data.get("analysis_status") is None:
        return None
    return analysis_to_dict(row)


def track_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    data = dict(row)
    analysis = track_analysis_from_joined_row(row)
    data = {key: value for key, value in data.items() if not key.startswith("analysis_")}
    data["favorite"] = bool(data["favorite"])
    data["listened"] = bool(data["listened"])
    data["analysis"] = analysis
    if data.get("cover_art_filepath"):
        data["cover_art_endpoint"] = f"/api/music/tracks/{data['id']}/artwork"
    else:
        data["cover_art_endpoint"] = None
    return data


def save_track_analysis(conn: sqlite3.Connection, analysis: dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO track_analysis (
            track_id, bpm, musical_key, energy, energy_label, danceability, vocal_score,
            loudness, intro_end, outro_start, beat_interval, first_beat, beat_confidence,
            drop_times_json, breakdown_times_json,
            status, error, analysis_version, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(track_id) DO UPDATE SET
            bpm = excluded.bpm,
            musical_key = excluded.musical_key,
            energy = excluded.energy,
            energy_label = excluded.energy_label,
            danceability = excluded.danceability,
            vocal_score = excluded.vocal_score,
            loudness = excluded.loudness,
            intro_end = excluded.intro_end,
            outro_start = excluded.outro_start,
            beat_interval = excluded.beat_interval,
            first_beat = excluded.first_beat,
            beat_confidence = excluded.beat_confidence,
            drop_times_json = excluded.drop_times_json,
            breakdown_times_json = excluded.breakdown_times_json,
            status = excluded.status,
            error = excluded.error,
            analysis_version = excluded.analysis_version,
            updated_at = excluded.updated_at
        """,
        (
            analysis["track_id"],
            analysis.get("bpm"),
            analysis.get("musical_key"),
            analysis.get("energy"),
            analysis.get("energy_label"),
            analysis.get("danceability"),
            analysis.get("vocal_score"),
            analysis.get("loudness"),
            analysis.get("intro_end"),
            analysis.get("outro_start"),
            analysis.get("beat_interval"),
            analysis.get("first_beat"),
            analysis.get("beat_confidence"),
            json.dumps(analysis.get("drop_times") or []),
            json.dumps(analysis.get("breakdown_times") or []),
            analysis.get("status", "estimated"),
            analysis.get("error", ""),
            analysis.get("analysis_version", ANALYSIS_VERSION),
            analysis.get("updated_at", utc_now()),
        ),
    )


def analyze_track(library: MusicLibrary, track: sqlite3.Row, use_audio: bool = True) -> dict[str, Any]:
    base = estimate_track_from_metadata(track)
    audio_path = Path(track["imported_filepath"])
    if use_audio and audio_path.exists():
        audio_result = analyze_track_audio(audio_path)
        if audio_result:
            described_bpm = base.get("bpm") if base.get("status") == "described" else None
            base.update(audio_result)
            if described_bpm and audio_result.get("bpm"):
                base["bpm"] = reconcile_described_bpm(float(described_bpm), float(audio_result["bpm"]))
                if base["bpm"] == described_bpm:
                    base["status"] = "described"
                    base["error"] = "BPM read from description; audio detector found a half/double-time compatible tempo."
                else:
                    base["status"] = "complete"
            else:
                base["status"] = "complete"
    base["track_id"] = track["id"]
    base["analysis_version"] = ANALYSIS_VERSION
    base["updated_at"] = utc_now()
    return base


def reconcile_described_bpm(described_bpm: float, detected_bpm: float) -> float:
    if abs(described_bpm - detected_bpm) <= 3:
        return round(detected_bpm, 1)
    if abs(described_bpm - detected_bpm * 2) <= 6:
        return round(described_bpm, 1)
    if abs(described_bpm * 2 - detected_bpm) <= 6:
        return round(described_bpm, 1)
    return round(detected_bpm, 1)


def analyze_track_audio(path: Path) -> dict[str, Any] | None:
    try:
        import librosa  # type: ignore
        import numpy as np  # type: ignore
    except Exception:
        return None

    try:
        samples, sample_rate = librosa.load(str(path), sr=22050, mono=True, duration=45)
        if samples.size < sample_rate:
            return None
        tempo, beats = librosa.beat.beat_track(y=samples, sr=sample_rate)
        rms = librosa.feature.rms(y=samples)[0]
        centroid = librosa.feature.spectral_centroid(y=samples, sr=sample_rate)[0]
        chroma = librosa.feature.chroma_cqt(y=samples, sr=sample_rate)
        key_index = int(np.argmax(np.mean(chroma, axis=1)))
        key_name = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "A#/Bb", "B"][key_index]
        energy = clamp01(float(np.percentile(rms, 85) / (np.percentile(rms, 98) + 1e-9)))
        brightness = clamp01(float(np.mean(centroid) / 4500))
        danceability = clamp01((len(beats) / max(1, len(samples) / sample_rate) / 3.2) + energy * 0.35)
        duration = len(samples) / sample_rate
        drop_times = [round(float(librosa.frames_to_time(frame, sr=sample_rate)), 1) for frame in beats[::32][:4]]
        beat_times = librosa.frames_to_time(beats, sr=sample_rate) if len(beats) else []
        beat_interval = 60 / max(1, float(np.asarray(tempo).item()))
        first_beat = float(beat_times[0]) if len(beat_times) else 0
        beat_confidence = clamp01(min(1, len(beats) / max(8, duration / beat_interval)) * 0.85 + energy * 0.15)
        return {
            "bpm": round(float(np.asarray(tempo).item()), 1),
            "musical_key": key_name,
            "energy": round(clamp01((energy * 0.7) + (brightness * 0.3)), 2),
            "energy_label": energy_label((energy * 0.7) + (brightness * 0.3)),
            "danceability": round(danceability, 2),
            "vocal_score": None,
            "loudness": round(float(20 * math.log10(float(np.mean(rms)) + 1e-9)), 1),
            "intro_end": round(min(32, max(8, duration * 0.08)), 1),
            "outro_start": round(max(0, duration - min(40, max(16, duration * 0.12))), 1),
            "beat_interval": round(beat_interval, 4),
            "first_beat": round(first_beat, 3),
            "beat_confidence": round(beat_confidence, 2),
            "drop_times": drop_times,
            "breakdown_times": [],
            "error": "",
        }
    except Exception as exc:
        return {"status": "estimated", "error": f"Audio analysis unavailable: {exc}"}
    finally:
        gc.collect()


def estimate_track_from_metadata(track: sqlite3.Row) -> dict[str, Any]:
    text = " ".join(
        str(track[key] or "")
        for key in ("display_title", "note", "full_generation_prompt", "lyrics", "generation_model_version")
        if key in track.keys()
    ).lower()
    rating_energy = {"S": 0.9, "A": 0.78, "B": 0.62, "C": 0.44, "D": 0.25}
    energy = rating_energy.get(track["rating"], 0.52)
    bpm = 112.0
    bpm_source = "estimated"
    musical_key = None
    danceability = 0.5
    vocal_score = 0.35

    energy_terms = {
        "dnb": (174, 0.88, 0.85),
        "drum and bass": (174, 0.9, 0.85),
        "dubstep": (140, 0.84, 0.75),
        "techno": (128, 0.82, 0.82),
        "club": (124, 0.76, 0.8),
        "trap": (140, 0.72, 0.7),
        "bass": (128, 0.75, 0.72),
        "drop": (132, 0.8, 0.75),
        "peak": (128, 0.82, 0.78),
        "soul": (92, 0.48, 0.55),
        "soulful": (94, 0.5, 0.58),
        "piano": (82, 0.38, 0.38),
        "gospel": (96, 0.52, 0.45),
        "choir": (88, 0.42, 0.32),
        "cinematic": (96, 0.55, 0.42),
        "holiday": (102, 0.5, 0.45),
        "sleigh": (108, 0.58, 0.5),
        "gentle": (78, 0.3, 0.32),
        "intimate": (84, 0.34, 0.38),
    }
    matches = [values for term, values in energy_terms.items() if term in text]
    if matches:
        bpm = sum(item[0] for item in matches) / len(matches)
        energy = clamp01((energy + sum(item[1] for item in matches) / len(matches)) / 2)
        danceability = clamp01(sum(item[2] for item in matches) / len(matches))
    described_bpm = extract_described_bpm(text)
    if described_bpm:
        bpm = described_bpm
        bpm_source = "described"

    key_match = re_search_key(text)
    if key_match:
        musical_key = key_match
    vocal_score = 0.72 if any(term in text for term in ("vocal", "lyrics", "singer", "alto", "choir")) else vocal_score
    vocal_score = 0.08 if any(term in text for term in ("instrumental", "no vocals", "no guitars or vocals")) else vocal_score
    duration = track["duration_seconds"] or 180
    return {
        "bpm": round(bpm, 1),
        "musical_key": musical_key,
        "energy": round(energy, 2),
        "energy_label": energy_label(energy),
        "danceability": round(danceability, 2),
        "vocal_score": round(vocal_score, 2),
        "loudness": None,
        "intro_end": round(min(32, max(8, duration * 0.08)), 1),
        "outro_start": round(max(0, duration - min(40, max(16, duration * 0.12))), 1),
        "beat_interval": round(60 / max(1, bpm), 4),
        "first_beat": 0,
        "beat_confidence": 0.72 if bpm_source == "described" else 0.28,
        "drop_times": [],
        "breakdown_times": [],
        "status": bpm_source,
        "error": "BPM read from description; install audio analysis dependencies for DSP confirmation."
        if bpm_source == "described"
        else "Estimated from metadata; install audio analysis dependencies for DSP results.",
    }


def extract_described_bpm(text: str) -> float | None:
    values: list[float] = []
    patterns = [
        r"\b(\d{2,3}(?:\.\d+)?)\s*bpm\b",
        r"\bbpm\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)\b",
        r"\btempo\s*[:=]?\s*(\d{2,3}(?:\.\d+)?)\b",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            value = float(match.group(1))
            if 45 <= value <= 220:
                values.append(value)
    if not values:
        return None
    fast_values = [value for value in values if value >= 90]
    return round(max(fast_values or values), 1)


def re_search_key(text: str) -> str | None:
    for key in ("C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"):
        pattern = rf"\b{key.lower().replace('#', '#').replace('b', 'b')}\s+(minor|major)\b"
        if re.search(pattern, text):
            return key
    return None


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def energy_label(value: float | None) -> str:
    if value is None:
        return "Unknown"
    if value < 0.35:
        return "Chill"
    if value < 0.58:
        return "Groove"
    if value < 0.78:
        return "Drive"
    return "Peak"


def playlist_to_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    tracks = conn.execute(
        """
        SELECT track_id
        FROM playlist_tracks
        WHERE playlist_id = ?
        ORDER BY position ASC, added_at ASC
        """,
        (row["id"],),
    ).fetchall()
    track_ids = [track["track_id"] for track in tracks]
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "is_special": bool(row["is_special"]),
        "track_ids": track_ids,
        "track_count": len(track_ids),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def resequence_playlist(conn: sqlite3.Connection, playlist_id: int) -> None:
    rows = conn.execute(
        "SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position ASC, added_at ASC",
        (playlist_id,),
    ).fetchall()
    for index, row in enumerate(rows, start=1):
        conn.execute(
            "UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?",
            (index, playlist_id, row["track_id"]),
        )


def is_relative_to(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def portable_path_name(value: str) -> str:
    windows_name = PureWindowsPath(value).name
    posix_name = Path(value).name
    return windows_name if len(windows_name) < len(posix_name) else posix_name


def safe_extract_zip(archive: zipfile.ZipFile, destination: Path) -> None:
    destination_root = destination.resolve()
    for member in archive.infolist():
        target = (destination / member.filename).resolve()
        if not is_relative_to(target, destination_root):
            raise HTTPException(status_code=400, detail="Backup contains unsafe paths")
    archive.extractall(destination)


def restore_from_zip(library: MusicLibrary, archive_path: Path, actual_sha256: str) -> dict[str, Any]:
    staging_parent = archive_path.parent
    staging_dir = staging_parent / "restore-staging"
    if staging_dir.exists():
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True)
    try:
        try:
            with zipfile.ZipFile(archive_path) as archive:
                safe_extract_zip(archive, staging_dir)
        except zipfile.BadZipFile as exc:
            raise HTTPException(status_code=400, detail="Backup is not a valid zip file") from exc

        source_root = staging_dir / "MusicLibrary"
        if not source_root.exists():
            source_root = staging_dir
        if not (source_root / "Data" / "music_library.sqlite3").exists():
            raise HTTPException(status_code=400, detail="Backup does not contain Data/music_library.sqlite3")

        backup_dir = library.root.with_name(f"{library.root.name}.previous-restore")
        if backup_dir.exists():
            shutil.rmtree(backup_dir)
        if library.root.exists() and any(library.root.iterdir()):
            library.root.rename(backup_dir)
        library.root.mkdir(parents=True, exist_ok=True)

        for item in source_root.iterdir():
            destination = library.root / item.name
            if item.is_dir():
                shutil.move(str(item), str(destination))
            else:
                shutil.move(str(item), str(destination))
    finally:
        shutil.rmtree(staging_dir, ignore_errors=True)

    library.setup()
    with library.connect() as conn:
        stats = library_stats(conn)
    return {"restored": True, "sha256": actual_sha256, "stats": stats}


def run_chunk_restore_job(
    library: MusicLibrary,
    upload_dir: Path,
    total_parts: int,
    expected_sha256: str,
) -> None:
    try:
        write_restore_status(upload_dir, {"state": "running", "message": "Assembling uploaded chunks"})
        archive_path = prepare_restore_archive(upload_dir, total_parts, expected_sha256)
        write_restore_status(upload_dir, {"state": "running", "message": "Extracting backup"})
        result = restore_from_zip(library, archive_path, expected_sha256)
        write_restore_status(upload_dir, {"state": "complete", "message": "Restore complete", "result": result})

        for part_path in upload_dir.glob("*.part"):
            part_path.unlink(missing_ok=True)
        archive_path.unlink(missing_ok=True)
    except Exception as exc:
        write_restore_status(
            upload_dir,
            {
                "state": "failed",
                "message": str(exc),
                "traceback": traceback.format_exc(limit=8),
            },
        )


def prepare_restore_archive(upload_dir: Path, total_parts: int, expected_sha256: str) -> Path:
    archive_path = upload_dir / "music-library-backup.zip"
    if archive_path.exists() and sha256_file(archive_path).lower() == expected_sha256:
        return archive_path

    digest = hashlib.sha256()
    with archive_path.open("wb") as output:
        for index in range(total_parts):
            part_path = upload_dir / f"{index:06d}.part"
            if not part_path.exists():
                raise RuntimeError(f"Missing restore part {index}")
            with part_path.open("rb") as part:
                for chunk in iter(lambda: part.read(1024 * 1024), b""):
                    digest.update(chunk)
                    output.write(chunk)

    actual_sha256 = digest.hexdigest()
    if expected_sha256 != actual_sha256:
        raise RuntimeError("Backup checksum did not match")
    return archive_path


def read_restore_status(upload_dir: Path) -> dict[str, Any]:
    status_path = upload_dir / "restore-status.json"
    if not status_path.exists():
        part_count = len(list(upload_dir.glob("*.part"))) if upload_dir.exists() else 0
        return {"state": "uploaded", "message": "Chunks uploaded", "parts": part_count}
    try:
        return json.loads(status_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"state": "unknown", "message": "Restore status could not be parsed"}


def write_restore_status(upload_dir: Path, status: dict[str, Any]) -> None:
    upload_dir.mkdir(parents=True, exist_ok=True)
    payload = {**status, "updated_at": utc_now()}
    (upload_dir / "restore-status.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")


def extract_provider_tracks(payload: dict[str, Any]) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            if any(key in value for key in ("audio_url", "source_audio_url", "download_url")):
                tracks.append(value)
            result_json = value.get("resultJson")
            if isinstance(result_json, str):
                try:
                    visit(json.loads(result_json))
                except json.JSONDecodeError:
                    pass
            for child in value.values():
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(payload)
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for track in tracks:
        key = str(track.get("audio_url") or track.get("source_audio_url") or track.get("download_url"))
        if key and key not in seen:
            seen.add(key)
            deduped.append(track)
    return deduped


def ingest_external_track(library: MusicLibrary, payload: SunoIngestRequest) -> tuple[dict[str, Any], bool]:
    incoming_dir = library.inbox_dir / "Suno Auto"
    incoming_dir.mkdir(parents=True, exist_ok=True)

    audio_path = download_remote_file(payload.audio_url, incoming_dir, payload.title or payload.generation_id or "suno-track")
    artwork_path: Optional[Path] = None
    if payload.artwork_url:
        artwork_path = download_remote_file(
            payload.artwork_url,
            library.artwork_dir,
            payload.generation_id or audio_path.stem,
            allowed_extensions={".jpg", ".jpeg", ".png", ".webp"},
        )
    return ingest_downloaded_track(library, payload, audio_path, artwork_path)


def ingest_downloaded_track(
    library: MusicLibrary,
    payload: SunoIngestRequest,
    audio_path: Path,
    artwork_path: Optional[Path],
) -> tuple[dict[str, Any], bool]:
    file_hash = sha256_file(audio_path)
    stat = audio_path.stat()
    now = utc_now()

    with library.connect() as conn:
        existing = conn.execute("SELECT * FROM tracks WHERE file_hash = ?", (file_hash,)).fetchone()
        if existing:
            track_id = existing["id"]
            apply_suno_metadata(conn, track_id, payload, artwork_path, now)
            ensure_playlist_track(conn, payload.playlist_name, track_id, now)
            return track_to_dict(get_track(conn, track_id)), True

        metadata = audio_metadata(audio_path, stat.st_size)
        track_id = library.next_track_id(conn)
        imported_path = unique_import_path(library.originals_dir, track_id, audio_path.suffix.lower())
        shutil.copy2(audio_path, imported_path)
        title = (payload.title or audio_path.stem.replace("_", " ").replace("-", " ")).strip() or track_id

        conn.execute(
            """
            INSERT INTO tracks (
                id, original_filename, display_title, original_filepath, imported_filepath,
                source_platform, source_generation_id, creation_date, import_date,
                generation_model_version, full_generation_prompt, negative_prompt, lyrics,
                cover_art_url, cover_art_filepath, duration_seconds, file_format,
                sample_rate, bitrate, channels, file_size, file_hash, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                track_id,
                audio_path.name,
                title,
                str(audio_path),
                str(imported_path),
                "Suno",
                payload.generation_id,
                payload.creation_date,
                now,
                payload.model_version,
                payload.prompt,
                payload.negative_prompt,
                payload.lyrics,
                payload.artwork_url,
                str(artwork_path) if artwork_path else None,
                metadata["duration_seconds"],
                audio_path.suffix.lower().lstrip("."),
                metadata["sample_rate"],
                metadata["bitrate"],
                metadata["channels"],
                stat.st_size,
                file_hash,
                now,
                now,
            ),
        )
        save_generation_metadata(conn, track_id, payload, now)
        ensure_playlist_track(conn, payload.playlist_name, track_id, now)
        return track_to_dict(get_track(conn, track_id)), False


def apply_suno_metadata(
    conn: sqlite3.Connection,
    track_id: str,
    payload: SunoIngestRequest,
    artwork_path: Optional[Path],
    now: str,
) -> None:
    updates: list[str] = [
        "source_platform = COALESCE(source_platform, ?)",
        "source_generation_id = COALESCE(source_generation_id, ?)",
        "generation_model_version = COALESCE(generation_model_version, ?)",
        "full_generation_prompt = COALESCE(full_generation_prompt, ?)",
        "negative_prompt = COALESCE(negative_prompt, ?)",
        "lyrics = COALESCE(lyrics, ?)",
        "cover_art_url = COALESCE(cover_art_url, ?)",
        "cover_art_filepath = COALESCE(cover_art_filepath, ?)",
        "updated_at = ?",
    ]
    conn.execute(
        f"UPDATE tracks SET {', '.join(updates)} WHERE id = ?",
        (
            "Suno",
            payload.generation_id,
            payload.model_version,
            payload.prompt,
            payload.negative_prompt,
            payload.lyrics,
            payload.artwork_url,
            str(artwork_path) if artwork_path else None,
            now,
            track_id,
        ),
    )
    save_generation_metadata(conn, track_id, payload, now)


def save_generation_metadata(conn: sqlite3.Connection, track_id: str, payload: SunoIngestRequest, now: str) -> None:
    raw_metadata = {
        **payload.raw_metadata,
        "audio_url": payload.audio_url,
        "artwork_url": payload.artwork_url,
        "title": payload.title,
        "generation_id": payload.generation_id,
        "prompt": payload.prompt,
        "negative_prompt": payload.negative_prompt,
        "lyrics": payload.lyrics,
        "model_version": payload.model_version,
        "creation_date": payload.creation_date,
    }
    conn.execute(
        """
        INSERT INTO generation_metadata (track_id, raw_metadata_json, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(track_id) DO UPDATE SET
            raw_metadata_json = excluded.raw_metadata_json,
            updated_at = excluded.updated_at
        """,
        (track_id, json.dumps(raw_metadata, indent=2), now, now),
    )


def ensure_playlist_track(conn: sqlite3.Connection, playlist_name: str, track_id: str, now: str) -> None:
    name = playlist_name.strip() or "Fresh Suno"
    row = conn.execute("SELECT * FROM playlists WHERE name = ?", (name,)).fetchone()
    if not row:
        cursor = conn.execute(
            "INSERT INTO playlists (name, description, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (name, "Automatically imported Suno tracks", now, now),
        )
        playlist_id = cursor.lastrowid
    else:
        playlist_id = row["id"]

    exists = conn.execute(
        "SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
        (playlist_id, track_id),
    ).fetchone()
    if exists:
        return

    position = conn.execute(
        "SELECT COALESCE(MAX(position), 0) + 1 AS next_position FROM playlist_tracks WHERE playlist_id = ?",
        (playlist_id,),
    ).fetchone()["next_position"]
    conn.execute(
        "INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)",
        (playlist_id, track_id, position, now),
    )
    conn.execute("UPDATE playlists SET updated_at = ? WHERE id = ?", (now, playlist_id))


def download_remote_file(
    url: str,
    destination_dir: Path,
    preferred_name: str,
    allowed_extensions: Optional[set[str]] = None,
) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    try:
        with requests.get(url, stream=True, timeout=(15, 180)) as response:
            response.raise_for_status()
            suffix = suffix_for_download(url, response.headers.get("content-type", ""), allowed_extensions)
            filename = safe_filename(preferred_name, suffix)
            destination = unique_download_path(destination_dir, filename)
            with destination.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        handle.write(chunk)
    except requests.RequestException as exc:
        raise HTTPException(status_code=400, detail=f"Could not download remote file: {exc}") from exc
    return destination


def save_upload_file(
    upload: UploadFile,
    destination_dir: Path,
    preferred_name: Optional[str],
    allowed_extensions: Optional[set[str]] = None,
) -> Path:
    destination_dir.mkdir(parents=True, exist_ok=True)
    suffix = Path(upload.filename or "").suffix.lower()
    if allowed_extensions and suffix not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported uploaded file type: {suffix}")
    if not allowed_extensions and suffix not in SUPPORTED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported uploaded audio type: {suffix}")

    filename = safe_filename(preferred_name or upload.filename or "suno-track", suffix)
    destination = unique_download_path(destination_dir, filename)
    with destination.open("wb") as handle:
        shutil.copyfileobj(upload.file, handle)
    return destination


def suffix_for_download(url: str, content_type: str, allowed_extensions: Optional[set[str]]) -> str:
    suffix = Path(url.split("?", 1)[0]).suffix.lower()
    if not suffix:
        suffix = {
            "audio/mpeg": ".mp3",
            "audio/mp3": ".mp3",
            "audio/wav": ".wav",
            "audio/x-wav": ".wav",
            "audio/mp4": ".m4a",
            "audio/flac": ".flac",
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
        }.get(content_type.split(";", 1)[0].strip().lower(), "")
    if allowed_extensions and suffix not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported downloaded file type: {suffix or content_type}")
    if not allowed_extensions and suffix not in SUPPORTED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported downloaded audio type: {suffix or content_type}")
    return suffix


def safe_filename(name: str, suffix: str) -> str:
    stem = "".join(character if character.isalnum() or character in {" ", "-", "_"} else "-" for character in name)
    stem = "-".join(stem.strip().split())[:120] or "suno-track"
    return f"{stem}{suffix}"


def unique_download_path(directory: Path, filename: str) -> Path:
    candidate = directory / filename
    index = 1
    while candidate.exists():
        candidate = directory / f"{Path(filename).stem}-{index}{Path(filename).suffix}"
        index += 1
    return candidate


def secrets_equal(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def safe_restore_session_id(session_id: str) -> bool:
    return bool(session_id) and all(character.isalnum() or character in {"-", "_"} for character in session_id)


def restore_upload_dir(library: MusicLibrary, session_id: str) -> Path:
    return library.root.parent / ".restore_uploads" / session_id


def ensure_column(conn: sqlite3.Connection, table: str, column: str, column_type: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def unique_import_path(directory: Path, track_id: str, suffix: str) -> Path:
    candidate = directory / f"{track_id}{suffix}"
    index = 1
    while candidate.exists():
        candidate = directory / f"{track_id}-{index}{suffix}"
        index += 1
    return candidate


def audio_metadata(path: Path, file_size: int) -> dict[str, Any]:
    if path.suffix.lower() == ".wav":
        try:
            with wave.open(str(path), "rb") as wav:
                frames = wav.getnframes()
                sample_rate = wav.getframerate()
                duration = frames / float(sample_rate) if sample_rate else None
                bitrate = int((file_size * 8) / duration) if duration else None
                return {
                    "duration_seconds": duration,
                    "sample_rate": sample_rate,
                    "channels": wav.getnchannels(),
                    "bitrate": bitrate,
                }
        except wave.Error:
            pass
    return {"duration_seconds": None, "sample_rate": None, "channels": None, "bitrate": None}


def media_type_for(path: Path) -> str:
    return {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
    }.get(path.suffix.lower(), "application/octet-stream")


def image_media_type_for(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "application/octet-stream")


def library_stats(conn: sqlite3.Connection) -> dict[str, Any]:
    rows = conn.execute("SELECT rating, COUNT(*) AS count FROM tracks GROUP BY rating").fetchall()
    rating_counts = {rating: 0 for rating in ["S", "A", "B", "C", "D"]}
    unrated = 0
    total = 0
    for row in rows:
        count = row["count"]
        total += count
        if row["rating"] is None:
            unrated = count
        else:
            rating_counts[row["rating"]] = count
    favorites = conn.execute("SELECT COUNT(*) AS count FROM tracks WHERE favorite = 1").fetchone()["count"]
    rated = total - unrated
    keepers = rating_counts["S"] + rating_counts["A"]
    return {
        "total_tracks": total,
        "unrated_tracks": unrated,
        "rated_tracks": rated,
        "rating_counts": rating_counts,
        "favorites_count": favorites,
        "keeper_rate": round(keepers / rated, 3) if rated else None,
        "percentage_rated": round(rated / total, 3) if total else 0,
    }
