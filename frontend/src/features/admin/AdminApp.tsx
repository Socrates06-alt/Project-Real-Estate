import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import { Building2, Inbox as InboxIcon, LogOut } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { AdminAuthProvider, useAdmin } from "@/features/admin/auth";
import Login from "@/features/admin/Login";
import Inbox from "@/features/admin/Inbox";
import Properties from "@/features/admin/Properties";
import PropertyPage from "@/features/admin/Property";

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
      "flex min-h-[52px] min-w-[76px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[12px] font-medium transition-colors",
      isActive ? "bg-white text-[var(--brand-deep)] shadow-md" : "text-white/80",
    );
  return (
    <nav className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="nav-pill flex items-center gap-1 rounded-full p-1.5">
        <NavLink to="/admin" end className={item}>
          <InboxIcon size={22} /> Inbox
        </NavLink>
        <NavLink to="/admin/properties" className={item}>
          <Building2 size={22} /> Properties
        </NavLink>
        <button onClick={() => window.confirm("Sign out?") && signOut()} className={item({ isActive: false })}>
          <LogOut size={21} /> Sign out
        </button>
      </div>
    </nav>
  );
}
