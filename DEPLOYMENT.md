# Thismoment Music Deployment

This app should be deployed as one web service at first: the FastAPI backend serves the built React app and the music API from the same domain.

## Recommended first host

Use Render, Railway, or Fly with Docker support and a persistent disk/volume.

The service needs:

- Docker build from the repository root.
- A persistent disk mounted at `/var/data`.
- `MUSIC_LIBRARY_ROOT=/var/data/MusicLibrary`.
- `FRONTEND_BUILD_DIR=/app/frontend/build`.

## Why this shape

The `/music` page is only half the product. The audio files, artwork, SQLite library database, playlists, and API are served by FastAPI. A static frontend-only deploy would load the interface but break playback.

## Render path

`render.yaml` defines a starter web service with a 10 GB disk. After creating the service, upload or import songs into the hosted library inbox, then use the app's import flow.

## Later upgrade

Once the DJ app grows, move audio and artwork from the persistent disk to object storage such as Supabase Storage, Cloudflare R2, or S3. Keep SQLite or move metadata to Postgres when multi-device editing becomes important.
