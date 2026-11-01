# Nilayam frontend

React + Vite + TypeScript + Tailwind v4, with shadcn-style components in `src/components/ui`.
Mobile-first, feed-style UI. All data goes through the FastAPI backend. Admin login is a
single password in the prototype (Supabase Auth planned for V1).

```
src/
  pages/         Explore · ListingDetail · Sell · Profile   (public, no login)
  admin/         lazy-loaded admin app at /admin (password login, checked on every API call)
  components/    ListingCard, PhotoCarousel, VisitSheet, BottomNav, ui/*
  lib/           api client + types, formatting, device token, data hook
```

## Run

```bash
cd frontend
npm install
cp .env.example .env.local   # optional: VITE_API_URL
npm run dev                  # http://localhost:5173 (proxies /api and /media to :8000)
npm run build                # type-check + production build into dist/
```

Routes: `/` Explore · `/p/:id` property · `/sell` · `/me` · `/admin` (not linked from the public app).
