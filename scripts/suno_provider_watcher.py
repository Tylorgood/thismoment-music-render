from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Optional

import requests


DEFAULT_INGEST_URL = "https://thismoment-music.onrender.com/api/music/suno/ingest"
DEFAULT_WEBHOOK_BASE = "https://thismoment-music.onrender.com/api/music/suno/webhook"


def main() -> int:
    parser = argparse.ArgumentParser(description="Submit/poll third-party Suno API tasks and import completed tracks.")
    parser.add_argument("--provider", default=os.environ.get("SUNO_PROVIDER", "sunoapi"), choices=["sunoapi", "apixo"])
    parser.add_argument("--api-key", default=os.environ.get("SUNO_PROVIDER_API_KEY"))
    parser.add_argument("--base-url", default=os.environ.get("SUNO_PROVIDER_BASE_URL"))
    parser.add_argument("--ingest-url", default=os.environ.get("SUNO_INGEST_URL", DEFAULT_INGEST_URL))
    parser.add_argument("--ingest-token", default=os.environ.get("SUNO_INGEST_TOKEN"))
    parser.add_argument("--webhook-secret", default=os.environ.get("SUNO_WEBHOOK_SECRET") or os.environ.get("SUNO_INGEST_TOKEN"))
    parser.add_argument("--state", default=os.environ.get("SUNO_PROVIDER_STATE", ".suno-provider-state.json"))
    parser.add_argument("--interval", type=float, default=float(os.environ.get("SUNO_PROVIDER_INTERVAL", "30")))

    subparsers = parser.add_subparsers(dest="command", required=True)

    submit = subparsers.add_parser("submit", help="Submit a new generation task and save it to the watcher queue.")
    submit.add_argument("--prompt", required=True)
    submit.add_argument("--title", default="")
    submit.add_argument("--style", default="")
    submit.add_argument("--model", default=os.environ.get("SUNO_MODEL", "V5_5"))
    submit.add_argument("--custom-mode", action="store_true")
    submit.add_argument("--instrumental", action="store_true")
    submit.add_argument("--playlist", default=os.environ.get("SUNO_PLAYLIST_NAME", "Fresh Suno"))

    add_task = subparsers.add_parser("add-task", help="Add an existing provider task ID to the watcher queue.")
    add_task.add_argument("task_id")
    add_task.add_argument("--prompt", default="")
    add_task.add_argument("--title", default="")
    add_task.add_argument("--playlist", default=os.environ.get("SUNO_PLAYLIST_NAME", "Fresh Suno"))

    subparsers.add_parser("once", help="Poll queued tasks once and import completed tracks.")
    subparsers.add_parser("watch", help="Continuously poll queued tasks and import completed tracks.")
    subparsers.add_parser("list", help="Show queued task state.")

    args = parser.parse_args()
    state_path = Path(args.state).expanduser().resolve()
    state = load_state(state_path)

    if args.command == "list":
        print(json.dumps(state, indent=2))
        return 0

    require(args.api_key, "SUNO_PROVIDER_API_KEY is required.")
    if args.command in {"once", "watch"}:
        require(args.ingest_token, "SUNO_INGEST_TOKEN is required.")

    adapter = make_adapter(args)

    if args.command == "submit":
        task_id = adapter.submit(
            prompt=args.prompt,
            title=args.title,
            style=args.style,
            model=args.model,
            custom_mode=args.custom_mode,
            instrumental=args.instrumental,
            webhook_url=webhook_url(args),
        )
        remember_task(state, task_id, args.provider, args.prompt, args.title, args.playlist)
        save_state(state_path, state)
        print(f"queued task {task_id}")
        return 0

    if args.command == "add-task":
        remember_task(state, args.task_id, args.provider, args.prompt, args.title, args.playlist)
        save_state(state_path, state)
        print(f"queued task {args.task_id}")
        return 0

    while True:
        changed = poll_tasks(adapter, args, state)
        if changed:
            save_state(state_path, state)
        if args.command == "once":
            return 0
        time.sleep(args.interval)


class SunoApiAdapter:
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = (base_url or "https://api.sunoapi.org").rstrip("/")

    def submit(
        self,
        prompt: str,
        title: str,
        style: str,
        model: str,
        custom_mode: bool,
        instrumental: bool,
        webhook_url: str,
    ) -> str:
        payload: dict[str, Any] = {
            "prompt": prompt,
            "customMode": custom_mode,
            "instrumental": instrumental,
            "model": model,
            "callBackUrl": webhook_url,
        }
        if custom_mode:
            payload["title"] = title or "Untitled Suno Track"
            payload["style"] = style or "Electronic"
        response = requests.post(
            f"{self.base_url}/api/v1/generate",
            headers=self.headers(json_body=True),
            json=payload,
            timeout=(15, 60),
        )
        response.raise_for_status()
        data = response.json()
        return str(data.get("data", {}).get("taskId") or data.get("taskId"))

    def poll(self, task_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base_url}/api/v1/generate/record-info",
            headers=self.headers(),
            params={"taskId": task_id},
            timeout=(15, 60),
        )
        response.raise_for_status()
        return response.json()

    def completed_tracks(self, result: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
        data = result.get("data", {})
        status = str(data.get("status", "")).upper()
        if status == "SUCCESS":
            tracks = extract_tracks(data.get("response", {}).get("data", []))
            return "complete", tracks
        if status in {"FAILED", "ERROR"}:
            return "failed", []
        return "pending", []

    def headers(self, json_body: bool = False) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers


class ApixoAdapter:
    def __init__(self, api_key: str, base_url: Optional[str] = None):
        self.api_key = api_key
        self.base_url = (base_url or "https://api.apixo.ai/api/v1").rstrip("/")

    def submit(
        self,
        prompt: str,
        title: str,
        style: str,
        model: str,
        custom_mode: bool,
        instrumental: bool,
        webhook_url: str,
    ) -> str:
        input_payload: dict[str, Any] = {
            "mode": model,
            "prompt": prompt,
            "customMode": custom_mode,
            "instrumental": instrumental,
        }
        if title:
            input_payload["title"] = title
        if style:
            input_payload["style"] = style
        payload = {
            "request_type": "async",
            "input": input_payload,
            "webhook": webhook_url,
        }
        response = requests.post(
            f"{self.base_url}/generateTask/suno",
            headers=self.headers(json_body=True),
            json=payload,
            timeout=(15, 60),
        )
        response.raise_for_status()
        data = response.json()
        return str(data.get("data", {}).get("taskId") or data.get("taskId"))

    def poll(self, task_id: str) -> dict[str, Any]:
        response = requests.get(
            f"{self.base_url}/statusTask/suno",
            headers=self.headers(),
            params={"taskId": task_id},
            timeout=(15, 60),
        )
        response.raise_for_status()
        return response.json()

    def completed_tracks(self, result: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
        data = result.get("data", {})
        state = str(data.get("state", "")).lower()
        if state == "success":
            result_json = data.get("resultJson")
            parsed = json.loads(result_json) if isinstance(result_json, str) else result_json
            return "complete", extract_tracks(parsed)
        if state == "failed":
            return "failed", []
        return "pending", []

    def headers(self, json_body: bool = False) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        if json_body:
            headers["Content-Type"] = "application/json"
        return headers


def poll_tasks(adapter: Any, args: argparse.Namespace, state: dict[str, Any]) -> bool:
    changed = False
    for task_id, task in list(state.get("tasks", {}).items()):
        if task.get("status") in {"complete", "failed"}:
            continue
        try:
            result = adapter.poll(task_id)
            status, tracks = adapter.completed_tracks(result)
        except (requests.RequestException, json.JSONDecodeError) as exc:
            task["last_error"] = str(exc)
            changed = True
            continue

        task["last_poll_at"] = timestamp()
        task["last_result"] = result
        if status == "pending":
            changed = True
            continue
        if status == "failed":
            task["status"] = "failed"
            changed = True
            print(f"failed: {task_id}")
            continue

        imported = []
        for index, track in enumerate(tracks):
            audio_url = track.get("audio_url") or track.get("source_audio_url") or track.get("download_url")
            if not audio_url:
                continue
            payload = {
                "token": args.ingest_token,
                "audio_url": audio_url,
                "title": track.get("title") or task.get("title") or f"Suno task {task_id} #{index + 1}",
                "generation_id": track.get("id") or track.get("audio_id") or f"{task_id}-{index + 1}",
                "artwork_url": track.get("image_url") or track.get("cover_url") or track.get("artwork_url"),
                "prompt": track.get("prompt") or task.get("prompt"),
                "lyrics": track.get("lyrics"),
                "model_version": track.get("model") or task.get("model"),
                "playlist_name": task.get("playlist") or "Fresh Suno",
                "raw_metadata": {"provider": args.provider, "task_id": task_id, "track": track, "task_result": result},
            }
            response = requests.post(args.ingest_url, json=payload, timeout=(15, 300))
            response.raise_for_status()
            imported.append(response.json().get("imported", {}))

        task["status"] = "complete"
        task["imported"] = imported
        task["completed_at"] = timestamp()
        changed = True
        print(f"complete: {task_id} imported={len(imported)}")
    return changed


def extract_tracks(value: Any) -> list[dict[str, Any]]:
    tracks: list[dict[str, Any]] = []

    def visit(node: Any) -> None:
        if isinstance(node, dict):
            if any(key in node for key in ("audio_url", "source_audio_url", "download_url")):
                tracks.append(node)
            if isinstance(node.get("resultJson"), str):
                try:
                    visit(json.loads(node["resultJson"]))
                except json.JSONDecodeError:
                    pass
            for child in node.values():
                visit(child)
        elif isinstance(node, list):
            for child in node:
                visit(child)

    visit(value)
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()
    for track in tracks:
        key = str(track.get("audio_url") or track.get("source_audio_url") or track.get("download_url"))
        if key and key not in seen:
            seen.add(key)
            deduped.append(track)
    return deduped


def make_adapter(args: argparse.Namespace) -> Any:
    if args.provider == "apixo":
        return ApixoAdapter(args.api_key, args.base_url)
    return SunoApiAdapter(args.api_key, args.base_url)


def webhook_url(args: argparse.Namespace) -> str:
    if not args.webhook_secret:
        return ""
    return f"{DEFAULT_WEBHOOK_BASE}/{args.provider}?secret={args.webhook_secret}"


def remember_task(
    state: dict[str, Any],
    task_id: str,
    provider: str,
    prompt: str,
    title: str,
    playlist: str,
) -> None:
    if not task_id or task_id == "None":
        raise RuntimeError("Provider did not return a task ID")
    state.setdefault("tasks", {})[task_id] = {
        "provider": provider,
        "status": "pending",
        "prompt": prompt,
        "title": title,
        "playlist": playlist,
        "queued_at": timestamp(),
    }


def timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def require(value: Optional[str], message: str) -> None:
    if not value:
        raise SystemExit(message)


def load_state(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"tasks": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"tasks": {}}
    return data if isinstance(data, dict) else {"tasks": {}}


def save_state(path: Path, state: dict[str, Any]) -> None:
    path.write_text(json.dumps(state, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
