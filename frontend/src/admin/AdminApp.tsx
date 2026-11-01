import { NavLink, Route, Routes } from "react-router-dom";
import { LogOut } from "lucide-react";
import { AdminAuthProvider, useAdmin } from "./auth";
import Login from "./Login";
import Queue from "./Queue";
import Listings from "./Listings";
import Visits from "./Visits";
import Editor from "./Editor";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Gate />
    </AdminAuthProvider>
  );
}

function Gate() {
  const { token, signOut } = useAdmin();
  if (!token) return <Login />;

  const tab = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-full px-4 py-2 text-[15px] font-medium transition-colors", isActive ? "bg-[var(--glass-active)] text-brand" : "text-sub hover:text-ink");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="sticky top-0 z-30 -mx-4 mb-5 flex flex-wrap items-center gap-3 bg-bg/85 px-4 py-3 backdrop-blur-xl">
        <span className="flex items-center gap-2">
          <Logo />
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Admin</span>
        </span>
        <nav className="order-last flex w-full gap-1 overflow-x-auto glass rounded-full p-1 shadow-card sm:order-none sm:ml-6 sm:w-auto">
          <NavLink to="/admin" end className={tab}>
            Submissions
          </NavLink>
          <NavLink to="/admin/listings" className={tab}>
            Listings
          </NavLink>
          <NavLink to="/admin/visits" className={tab}>
            Visits
          </NavLink>
        </nav>
        <button onClick={signOut} className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-sub hover:bg-surface">
          <LogOut size={16} /> Sign out
        </button>
      </header>
      <Routes>
        <Route index element={<Queue />} />
        <Route path="listings" element={<Listings />} />
        <Route path="visits" element={<Visits />} />
        <Route path="s/:id" element={<Editor />} />
      </Routes>
    </div>
  );
}
