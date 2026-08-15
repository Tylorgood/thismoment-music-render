# Thismoment Music Deployment

This app deploys as one web service: the FastAPI backend serves the built React app and the music API from the same domain.

## Production Render setup

The Blueprint uses a paid Render web service with a persistent disk:

- `plan: starter`
- Disk mounted at `/var/data`
- `MUSIC_LIBRARY_ROOT=/var/data/MusicLibrary`
- `FRONTEND_BUILD_DIR=/app/frontend/build`

## Why this shape

The `/music` page is only half the product. The audio files, artwork, SQLite library database, playlists, and API are served by FastAPI. A static frontend-only deploy would load the interface but break playback.

## Restore flow

Use the protected chunked restore endpoints to upload a zipped `MusicLibrary` backup, verify its SHA256 checksum, and restore it into the persistent disk.

## Later upgrade

Once the DJ app grows, move audio and artwork from the persistent disk to object storage such as Supabase Storage, Cloudflare R2, or S3. Keep SQLite or move metadata to Postgres when multi-device editing becomes important.
