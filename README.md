# Pratibimb · Dalaal Street

A classroom stock-market simulation for the Pratibimb Business Education Department.

## Run locally

```bash
pnpm install
pnpm dev
```

The demo uses fictional prices and browser-local data. There is no Supabase dependency or live market feed.

## Routes

- `/parent` — participant dashboard
- `/parent/login` — register or sign in with a demo username and PIN
- `/dalaal-street` — player terminal
- `/dalaal-street/test` — unranked sandbox
- `/dalaal-street/audience` — classroom market board
- `/dalaal-street/admin` — teacher controls

The isolated demo admin password is `pratibimb`.

## Persistence and sync

`DemoRepository` separates the UI/domain actions from the active `BrowserDemoRepository`. Participant, session and market state are stored in `localStorage` and synchronized between same-browser tabs with BroadcastChannel plus storage-event fallback. One open tab holds a short market-engine lease; an open admin tab takes priority. A future server repository can implement the same boundary for multi-device sessions.

This build intentionally does not provide secure authentication, shared cross-device state, or live financial data. Parent demo PINs are stored in the browser and visible to the local admin page. Clear this browser's site data to reset the demo.
