import { useLang } from "@/shared/i18n";
import { lazy, Suspense, useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "@/app/BottomNav";
import Explore from "@/features/explore/Explore";
import { trackView } from "@/shared/api/track";

// Pages other than the home list load on their own, so the first screen appears sooner.
// They are fetched quietly in the background once the home page is up, so opening them is still instant.
const loadDetail = () => import("@/features/listing/ListingDetail");
const loadSell = () => import("@/features/sell/Sell");
const loadProfile = () => import("@/features/profile/Profile");
const loadLegal = () => import("@/features/legal/Legal");
const ListingDetail = lazy(loadDetail);
const Sell = lazy(loadSell);
const Profile = lazy(loadProfile);
const Privacy = lazy(() => loadLegal().then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => loadLegal().then((m) => ({ default: m.Terms })));

function usePrefetch() {
  useEffect(() => {
    const go = () => [loadDetail, loadSell, loadProfile].forEach((f) => f().catch(() => {}));
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(go);
    else setTimeout(go, 1500);
  }, []);
}

// The map (and Leaflet) only loads when someone opens it.
const MapSearch = lazy(() => import("@/features/map/MapSearch"));

// Admin is a separate chunk; the public app never links to it.
const AdminApp = lazy(() => import("@/features/admin/AdminApp"));
const RequestProperty = lazy(() => import("@/features/request/RequestProperty"));

function PublicLayout({ nav = true }: { nav?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-xl px-4 pb-32">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
      {nav && <BottomNav />}
    </>
  );
}

function PageTracker() {
  const { pathname } = useLocation();
  useEffect(() => trackView(pathname), [pathname]);
  return null;
}

export default function App() {
  useLang(); // re-render everything when the language changes
  usePrefetch();
  return (
    <>
    <PageTracker />
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Explore />} />
        <Route path="sell" element={<Sell />} />
        <Route
          path="request"
          element={
            <Suspense fallback={null}>
              <RequestProperty />
            </Suspense>
          }
        />
        <Route path="me" element={<Profile />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
      </Route>
      <Route element={<PublicLayout nav={false} />}>
        <Route path="p/:id" element={<ListingDetail />} />
      </Route>
      <Route
        path="map"
        element={
          <Suspense fallback={null}>
            <MapSearch />
          </Suspense>
        }
      />
      <Route
        path="admin/*"
        element={
          <Suspense fallback={null}>
            <AdminApp />
          </Suspense>
        }
      />
      <Route element={<PublicLayout />}>
        <Route path="*" element={<Explore />} />
      </Route>
    </Routes>
    </>
  );
}
