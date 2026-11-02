import { NavLink } from "react-router-dom";
import { House, PlusCircle, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { to: "/", label: "Home", icon: House, end: true },
  { to: "/sell", label: "Sell", icon: PlusCircle, end: false },
  { to: "/me", label: "Profile", icon: UserRound, end: false },
];

/** Floating frosted pill: equal-width items, active item gets a soft highlight. */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <div className="nav-pill flex items-center gap-1 rounded-full p-1.5">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex min-h-[52px] min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[12px] font-medium transition-colors",
                isActive ? "bg-white text-[var(--brand-deep)] shadow-md" : "text-white/80 hover:text-white",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
