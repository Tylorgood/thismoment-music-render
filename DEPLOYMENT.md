# Thismoment Music Deployment

This app deploys as one web service at first: the FastAPI backend serves the built React app and the music API from the same domain.

## Free Render first deploy

The current `render.yaml` uses Render's free web service plan and stores the music library at `/tmp/MusicLibrary`. This is enough to verify the app online, but storage is ephemeral and the service may spin down when idle.

## Production upgrade

For reliable phone/car use, upgrade the service to a paid instance and add a persistent disk:

- `plan: starter` or better.
- Disk mounted at `/var/data`.
- `MUSIC_LIBRARY_ROOT=/var/data/MusicLibrary`.

## Why this shape

The `/music` page is only half the product. The audio files, artwork, SQLite library database, playlists, and API are served by FastAPI. A static frontend-only deploy would load the interface but break playback.

## Later upgrade

Once the DJ app grows, move audio and artwork from the persistent disk to object storage such as Supabase Storage, Cloudflare R2, or S3. Keep SQLite or move metadata to Postgres when multi-device editing becomes important.
