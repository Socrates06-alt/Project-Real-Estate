import { lazy, Suspense, useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { BottomNav } from "@/app/BottomNav";
import Explore from "@/features/explore/Explore";
import ListingDetail from "@/features/listing/ListingDetail";
import Sell from "@/features/sell/Sell";
import Profile from "@/features/profile/Profile";
import { Privacy, Terms } from "@/features/legal/Legal";

// The map (and Leaflet) only loads when someone opens it.
const MapSearch = lazy(() => import("@/features/map/MapSearch"));

// Admin is a separate chunk; the public app never links to it.
const AdminApp = lazy(() => import("@/features/admin/AdminApp"));

function PublicLayout({ nav = true }: { nav?: boolean }) {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <main className="mx-auto min-h-dvh max-w-xl px-4 pb-32">
        <Outlet />
      </main>
      {nav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Explore />} />
        <Route path="sell" element={<Sell />} />
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
  );
}
