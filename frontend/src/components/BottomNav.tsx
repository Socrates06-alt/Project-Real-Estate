import { NavLink } from "react-router-dom";
import { Compass, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const item = ({ isActive }: { isActive: boolean }) =>
    cn("flex h-12 w-16 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition", isActive ? "text-white" : "text-white/55 hover:text-white/80");

  return (
    <nav className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full bg-[#0f1716]/92 p-1.5 shadow-float backdrop-blur-xl dark:bg-[#1f2b2a]/92">
        <NavLink to="/" end className={item}>
          <Compass size={21} />
          Explore
        </NavLink>
        <NavLink to="/sell" aria-label="List your property" className="grid h-12 w-12 place-items-center rounded-full bg-brand text-brand-ink shadow-lg transition active:scale-95">
          <Plus size={26} strokeWidth={2.4} />
        </NavLink>
        <NavLink to="/me" className={item}>
          <UserRound size={21} />
          Profile
        </NavLink>
      </div>
    </nav>
  );
}
