# Nilayam frontend

React + Vite + TypeScript + Tailwind v4, with shadcn-style components in `src/components/ui`.
Mobile-first, feed-style UI. All data goes through the FastAPI backend; Supabase is used
only for admin login.

```
src/
  pages/         Explore · ListingDetail · Sell · Profile   (public, no login)
  admin/         lazy-loaded admin app at /admin (Supabase login + backend admin check)
  components/    ListingCard, PhotoCarousel, VisitSheet, BottomNav, ui/*
  lib/           api client + types, formatting, device token, data hook
```

## Run

```bash
cd frontend
npm install
cp .env.example .env.local   # Supabase URL + anon key for admin login
npm run dev                  # http://localhost:5173 (proxies /api and /media to :8000)
npm run build                # type-check + production build into dist/
```

Routes: `/` Explore · `/p/:id` property · `/sell` · `/me` · `/admin` (not linked from the public app).
