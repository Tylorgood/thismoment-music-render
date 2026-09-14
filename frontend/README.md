# This Moment V2 Frontend

> Read [OPENCODE.md](../OPENCODE.md) and [CURRENT_STATE.md](../docs/CURRENT_STATE.md) for ownership and the independent `/music` app. The persistence statement below applies to V2 business records; music history uses localStorage and cues/loops are volatile.

React frontend for the Supabase-backed operating system.

## Required Environment

Copy `.env.example` to `.env`:

```bash
REACT_APP_SUPABASE_URL=https://your-project-ref.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-public-anon-key
```

The app shows a setup gate until these values are configured.

## Scripts

```bash
npm start
npm run build
```

## Data Policy

Business records are stored in Supabase/Postgres. Browser localStorage is used only for the Supabase auth session token in the lightweight client.
