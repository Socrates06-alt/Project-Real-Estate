# LandFinder frontend

React + Vite + TypeScript + Tailwind v4, with shadcn-style components in `src/shared/ui`.
Mobile-first, feed-style UI. All data goes through the FastAPI backend.

Organised by feature. **Rules:** a feature may use `shared/`, but features never import from
each other, and `shared/` never imports from features. Anything two features need goes to `shared/`.

```
src/
  app/                 App routes + layouts, main.tsx, BottomNav
  features/
    explore/           home page: feed, ListingCard, FilterTiles, saved area
    listing/           property page
    map/               area (radius) search with Leaflet
    sell/              List your property form + unfinished-form memory
    profile/           My listings, How it works
    legal/             Terms of Service, Privacy Policy
    admin/             lazy-loaded admin app at /admin
  shared/
    ui/                button, sheet, field, switch, segmented, badge, toast
    components/        PageHeader, Logo, PhotoCarousel, VisitSheet, AreaInput, States...
    api/               API client + types
    lib/               formatting, place search, image shrinking, theme, data hook...
    styles/            index.css (colour tokens, components)
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
