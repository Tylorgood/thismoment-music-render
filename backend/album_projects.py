from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

try:
    from .music_library import MusicLibrary, secrets_equal, utc_now
except ImportError:  # standalone run (pytest / scripts)
    from music_library import MusicLibrary, secrets_equal, utc_now


class AlbumProjectSave(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=200)
    engine_version: str = Field(min_length=1, max_length=80)
    inputs: dict[str, Any] = Field(default_factory=dict)
    blueprint: dict[str, Any] = Field(default_factory=dict)
    approval: dict[str, Any] = Field(default_factory=dict)
    production: dict[str, Any] = Field(default_factory=dict)


class AlbumProjectState(BaseModel):
    model_config = ConfigDict(extra="ignore")

    inputs: dict[str, Any] = Field(default_factory=dict)
    blueprint: dict[str, Any] = Field(default_factory=dict)
    approval: dict[str, Any] = Field(default_factory=dict)
    production: dict[str, Any] = Field(default_factory=dict)
    status: Optional[str] = Field(default=None, max_length=40)


class VersionCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    label: str = Field(default="", max_length=200)


class RenameProject(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=200)


def album_project_token() -> str:
    return os.environ.get("SUNO_INGEST_TOKEN") or os.environ.get("MUSIC_RESTORE_TOKEN") or ""


def check_write_token(request: Request) -> None:
    token = album_project_token()
    if not token:
        raise HTTPException(status_code=503, detail="Album project writes are disabled until SUNO_INGEST_TOKEN is configured")
    provided = request.headers.get("x-album-project-token", "")
    if not provided or not secrets_equal(provided, token):
        raise HTTPException(status_code=403, detail="Invalid album project token")


def _dump(value: Any) -> str:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=True)


def _load(raw: str, fallback: Any) -> Any:
    try:
        return json.loads(raw or "{}")
    except (json.JSONDecodeError, TypeError):
        return fallback


def _summary(row: sqlite3.Row) -> dict[str, Any]:
    inputs = _load(row["inputs_json"], {})
    blueprint = _load(row["blueprint_json"], {})
    slots = blueprint.get("slots") or []
    return {
        "id": row["id"],
        "name": row["name"],
        "status": row["status"],
        "engine_version": row["engine_version"],
        "track_count": len(slots) if slots else inputs.get("trackCount"),
        "genre": inputs.get("genre") or blueprint.get("bible", {}).get("album", {}).get("genre"),
        "version_count": row["version_count"],
        "latest_version": row["latest_version"],
        "updated_at": row["updated_at"],
        "created_at": row["created_at"],
    }


def _projects_table_sql() -> str:
    return """SELECT p.id, p.name, p.status, p.engine_version, p.inputs_json, p.blueprint_json,
           p.approval_json, p.production_json, p.created_at, p.updated_at,
           (SELECT COUNT(*) FROM album_project_versions v WHERE v.project_id = p.id) AS version_count,
           COALESCE((SELECT MAX(v.version) FROM album_project_versions v WHERE v.project_id = p.id), 0) AS latest_version
      FROM album_projects p"""


def make_router(library: MusicLibrary) -> APIRouter:
    router = APIRouter(prefix="/album-projects", tags=["album-projects"])

    @router.get("")
    async def list_projects() -> list[dict[str, Any]]:
        library.setup()
        with library.connect() as conn:
            rows = conn.execute(f"{_projects_table_sql()} ORDER BY p.updated_at DESC").fetchall()
        return [_summary(row) for row in rows]

    def _fetch_project(conn: sqlite3.Connection, project_id: str) -> sqlite3.Row:
        row = conn.execute(
            f"{_projects_table_sql()} WHERE p.id = ?",
            (project_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Album project not found")
        return row

    @router.get("/{project_id}")
    async def get_project(project_id: str) -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            row = _fetch_project(conn, project_id)
            versions = conn.execute(
                "SELECT version, label, snapshot_name, created_at FROM album_project_versions WHERE project_id = ? ORDER BY version",
                (project_id,),
            ).fetchall()
        payload = _summary(row)
        payload["inputs"] = _load(row["inputs_json"], {})
        payload["blueprint"] = _load(row["blueprint_json"], {})
        payload["approval"] = _load(row["approval_json"], {})
        payload["production"] = _load(row["production_json"], {})
        payload["versions"] = [dict(version_row) for version_row in versions]
        return payload

    @router.get("/{project_id}/versions/{version}")
    async def get_project_version(project_id: str, version: int) -> dict[str, Any]:
        library.setup()
        with library.connect() as conn:
            _fetch_project(conn, project_id)
            version_row = conn.execute(
                "SELECT v.version, v.label, v.snapshot_name, v.inputs_json, v.blueprint_json, v.approval_json, v.production_json, v.created_at, p.engine_version FROM album_project_versions v JOIN album_projects p ON p.id = v.project_id WHERE v.project_id = ? AND v.version = ?",
                (project_id, version),
            ).fetchone()
            if not version_row:
                raise HTTPException(status_code=404, detail="Album project version not found")
        return {
            "project_id": project_id,
            "version": version_row["version"],
            "label": version_row["label"],
            "snapshot_name": version_row["snapshot_name"],
            "inputs": _load(version_row["inputs_json"], {}),
            "blueprint": _load(version_row["blueprint_json"], {}),
            "approval": _load(version_row["approval_json"], {}),
            "production": _load(version_row["production_json"], {}),
            "engine_version": version_row["engine_version"],
            "created_at": version_row["created_at"],
        }

    @router.post("")
    async def create_project(payload: AlbumProjectSave, request: Request) -> dict[str, Any]:
        check_write_token(request)
        library.setup()
        project_id = f"album_{uuid.uuid4().hex[:12]}"
        now = utc_now()
        with library.connect() as conn:
            conn.execute(
                "INSERT INTO album_projects (id, name, status, engine_version, inputs_json, blueprint_json, approval_json, production_json, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)",
                (project_id, payload.name, payload.engine_version, _dump(payload.inputs), _dump(payload.blueprint), _dump(payload.approval), _dump(payload.production), now, now),
            )
            conn.execute(
                "INSERT INTO album_project_versions (project_id, version, label, snapshot_name, inputs_json, blueprint_json, approval_json, production_json, created_at) VALUES (?, 1, '', ?, ?, ?, ?, ?, ?)",
                (project_id, payload.name, _dump(payload.inputs), _dump(payload.blueprint), _dump(payload.approval), _dump(payload.production), now),
            )
        return {"id": project_id, "name": payload.name, "version": 1, "created_at": now}

    @router.put("/{project_id}/state")
    async def update_project_state(project_id: str, payload: AlbumProjectState, request: Request) -> dict[str, Any]:
        check_write_token(request)
        library.setup()
        with library.connect() as conn:
            _fetch_project(conn, project_id)
            now = utc_now()
            if payload.status is not None:
                conn.execute(
                    "UPDATE album_projects SET inputs_json = ?, blueprint_json = ?, approval_json = ?, production_json = ?, status = ?, updated_at = ? WHERE id = ?",
                    (_dump(payload.inputs), _dump(payload.blueprint), _dump(payload.approval), _dump(payload.production), payload.status, now, project_id),
                )
            else:
                conn.execute(
                    "UPDATE album_projects SET inputs_json = ?, blueprint_json = ?, approval_json = ?, production_json = ?, updated_at = ? WHERE id = ?",
                    (_dump(payload.inputs), _dump(payload.blueprint), _dump(payload.approval), _dump(payload.production), now, project_id),
                )
        return {"id": project_id, "updated_at": now}

    @router.post("/{project_id}/versions")
    async def create_version(project_id: str, payload: VersionCreate, request: Request) -> dict[str, Any]:
        check_write_token(request)
        library.setup()
        with library.connect() as conn:
            row = _fetch_project(conn, project_id)
            next_version = conn.execute(
                "SELECT COALESCE(MAX(version), 0) + 1 AS next FROM album_project_versions WHERE project_id = ?",
                (project_id,),
            ).fetchone()["next"]
            now = utc_now()
            conn.execute(
                "INSERT INTO album_project_versions (project_id, version, label, snapshot_name, inputs_json, blueprint_json, approval_json, production_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (project_id, next_version, payload.label, row["name"], row["inputs_json"], row["blueprint_json"], row["approval_json"], row["production_json"], now),
            )
        return {"id": project_id, "version": next_version, "created_at": now}

    @router.post("/{project_id}/duplicate")
    async def duplicate_project(project_id: str, request: Request) -> dict[str, Any]:
        check_write_token(request)
        library.setup()
        with library.connect() as conn:
            row = _fetch_project(conn, project_id)
            new_id = f"album_{uuid.uuid4().hex[:12]}"
            now = utc_now()
            base_name = row["name"]
            conn.execute(
                "INSERT INTO album_projects (id, name, status, engine_version, inputs_json, blueprint_json, approval_json, production_json, created_at, updated_at) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)",
                (new_id, f"Copy of {base_name}", row["engine_version"], row["inputs_json"], row["blueprint_json"], row["approval_json"], row["production_json"], now, now),
            )
            conn.execute(
                "INSERT INTO album_project_versions (project_id, version, label, snapshot_name, inputs_json, blueprint_json, approval_json, production_json, created_at) VALUES (?, 1, '', ?, ?, ?, ?, ?, ?)",
                (new_id, f"Copy of {base_name}", row["inputs_json"], row["blueprint_json"], row["approval_json"], row["production_json"], now),
            )
        return {"id": new_id, "name": f"Copy of {base_name}", "version": 1, "created_at": now}

    @router.post("/{project_id}/rename")
    async def rename_project(project_id: str, payload: RenameProject, request: Request) -> dict[str, Any]:
        check_write_token(request)
        library.setup()
        with library.connect() as conn:
            _fetch_project(conn, project_id)
            now = utc_now()
            conn.execute("UPDATE album_projects SET name = ?, updated_at = ? WHERE id = ?", (payload.name, now, project_id))
        return {"id": project_id, "name": payload.name, "updated_at": now}

    @router.delete("/{project_id}")
    async def delete_project(project_id: str, request: Request) -> dict[str, Any]:
        check_write_token(request)
        library.setup()
        with library.connect() as conn:
            _fetch_project(conn, project_id)
            conn.execute("DELETE FROM album_projects WHERE id = ?", (project_id,))
        return {"deleted": True, "id": project_id}

    return router