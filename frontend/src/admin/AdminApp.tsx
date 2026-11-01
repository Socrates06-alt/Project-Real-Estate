import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Building2, Inbox as InboxIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminAuthProvider, useAdmin } from "./auth";
import Login from "./Login";
import Inbox from "./Inbox";
import Properties from "./Properties";
import PropertyPage from "./Property";

export default function AdminApp() {
  return (
    <AdminAuthProvider>
      <Gate />
    </AdminAuthProvider>
  );
}

function Gate() {
  const { token } = useAdmin();
  const { pathname } = useLocation();
  if (!token) return <Login />;
  const onPropertyPage = pathname.startsWith("/admin/p/");

  return (
    <>
      <main className="mx-auto min-h-dvh max-w-xl px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-32">
        <Routes>
          <Route index element={<Inbox />} />
          <Route path="properties" element={<Properties />} />
          <Route path="p/:id" element={<PropertyPage />} />
        </Routes>
      </main>
      {!onPropertyPage && <AdminNav />}
    </>
  );
}

function AdminNav() {
  const { signOut } = useAdmin();
  const item = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex h-11 min-w-[76px] flex-col items-center justify-center gap-0.5 rounded-full px-4 text-[11px] font-medium transition-colors",
      isActive ? "bg-[var(--glass-active)] text-ink" : "text-sub",
    );
  return (
    <nav className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="glass flex items-center gap-1 rounded-full p-1 shadow-float">
        <NavLink to="/admin" end className={item}>
          <InboxIcon size={19} /> Inbox
        </NavLink>
        <NavLink to="/admin/properties" className={item}>
          <Building2 size={19} /> Properties
        </NavLink>
        <button onClick={() => window.confirm("Sign out?") && signOut()} className={item({ isActive: false })}>
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </nav>
  );
}
