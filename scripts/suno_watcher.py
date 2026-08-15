from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional

import requests


AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac"}
ARTWORK_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
DEFAULT_API_URL = "https://thismoment-music.onrender.com/api/music/suno/upload"


def main() -> int:
    parser = argparse.ArgumentParser(description="Watch a local Suno download folder and auto-import new songs.")
    parser.add_argument("--watch", default=os.environ.get("SUNO_WATCH_DIR"), help="Folder to watch for new Suno downloads.")
    parser.add_argument("--api-url", default=os.environ.get("SUNO_UPLOAD_URL", DEFAULT_API_URL))
    parser.add_argument("--token", default=os.environ.get("SUNO_INGEST_TOKEN"))
    parser.add_argument("--playlist", default=os.environ.get("SUNO_PLAYLIST_NAME", "Fresh Suno"))
    parser.add_argument("--interval", type=float, default=float(os.environ.get("SUNO_WATCH_INTERVAL", "8")))
    parser.add_argument("--once", action="store_true", help="Scan once, upload new files, then exit.")
    args = parser.parse_args()

    if not args.watch:
        print("Set --watch or SUNO_WATCH_DIR to the folder where Suno downloads songs.", file=sys.stderr)
        return 2
    if not args.token:
        print("Set SUNO_INGEST_TOKEN before starting the watcher.", file=sys.stderr)
        return 2

    watch_dir = Path(args.watch).expanduser().resolve()
    watch_dir.mkdir(parents=True, exist_ok=True)
    state_path = watch_dir / ".suno-watcher-state.json"
    state = load_state(state_path)

    print(f"Watching {watch_dir}")
    print(f"Uploading to {args.api_url}")
    while True:
        uploaded = scan_once(watch_dir, state, args)
        if uploaded:
            save_state(state_path, state)
        if args.once:
            save_state(state_path, state)
            return 0
        time.sleep(args.interval)


def scan_once(watch_dir: Path, state: dict[str, Any], args: argparse.Namespace) -> int:
    uploaded = 0
    for audio_path in sorted(path for path in watch_dir.rglob("*") if path.suffix.lower() in AUDIO_EXTENSIONS):
        if is_temporary_download(audio_path) or not is_stable(audio_path):
            continue
        file_hash = sha256_file(audio_path)
        if file_hash in state.get("uploaded_hashes", {}):
            continue

        metadata = read_metadata(audio_path)
        metadata.setdefault("title", title_from_filename(audio_path))
        metadata.setdefault("playlist_name", args.playlist)
        artwork_path = find_artwork(audio_path, metadata)

        try:
            result = upload_track(args.api_url, args.token, audio_path, artwork_path, metadata)
        except requests.RequestException as exc:
            print(f"Upload failed for {audio_path.name}: {exc}", file=sys.stderr)
            continue

        track = result.get("imported", {})
        state.setdefault("uploaded_hashes", {})[file_hash] = {
            "path": str(audio_path),
            "track_id": track.get("id"),
            "title": track.get("display_title") or metadata.get("title"),
            "uploaded_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        }
        uploaded += 1
        label = "duplicate" if result.get("duplicate") else "imported"
        print(f"{label}: {audio_path.name} -> {track.get('id', 'unknown')}")
    return uploaded


def upload_track(
    api_url: str,
    token: str,
    audio_path: Path,
    artwork_path: Optional[Path],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    files: dict[str, Any] = {"audio": (audio_path.name, audio_path.open("rb"), media_type(audio_path))}
    if artwork_path:
        files["artwork"] = (artwork_path.name, artwork_path.open("rb"), image_media_type(artwork_path))
    try:
        response = requests.post(
            api_url,
            data={"token": token, "metadata_json": json.dumps(metadata)},
            files=files,
            timeout=(15, 300),
        )
        response.raise_for_status()
        return response.json()
    finally:
        for item in files.values():
            item[1].close()


def read_metadata(audio_path: Path) -> dict[str, Any]:
    candidates = [
        audio_path.with_suffix(".json"),
        audio_path.parent / f"{audio_path.stem}.metadata.json",
        audio_path.parent / f"{audio_path.stem}.suno.json",
    ]
    for candidate in candidates:
        if candidate.exists():
            try:
                data = json.loads(candidate.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                continue
            if isinstance(data, dict):
                return normalize_metadata(data)
    return {}


def normalize_metadata(data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(data)
    if "id" in normalized and "generation_id" not in normalized:
        normalized["generation_id"] = normalized["id"]
    if "audio_url" in normalized and "source_audio_url" not in normalized:
        normalized["source_audio_url"] = normalized["audio_url"]
    if "image_url" in normalized and "artwork_url" not in normalized:
        normalized["artwork_url"] = normalized["image_url"]
    return normalized


def find_artwork(audio_path: Path, metadata: dict[str, Any]) -> Optional[Path]:
    stems = [audio_path.stem]
    for key in ("generation_id", "id"):
        value = metadata.get(key)
        if isinstance(value, str) and value:
            stems.append(value)
    for stem in stems:
        for suffix in ARTWORK_EXTENSIONS:
            candidate = audio_path.parent / f"{stem}{suffix}"
            if candidate.exists() and is_stable(candidate):
                return candidate
    return None


def is_stable(path: Path) -> bool:
    try:
        first = path.stat().st_size
        time.sleep(1)
        second = path.stat().st_size
    except OSError:
        return False
    return first > 0 and first == second


def is_temporary_download(path: Path) -> bool:
    name = path.name.lower()
    return name.endswith(".crdownload") or name.endswith(".tmp") or name.endswith(".download")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def title_from_filename(path: Path) -> str:
    title = path.stem.replace("_", " ").replace("-", " ").strip()
    while "  " in title:
        title = title.replace("  ", " ")
    return title or "Suno Track"


def media_type(path: Path) -> str:
    return {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
    }.get(path.suffix.lower(), "application/octet-stream")


def image_media_type(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "application/octet-stream")


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"uploaded_hashes": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"uploaded_hashes": {}}
    return data if isinstance(data, dict) else {"uploaded_hashes": {}}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
