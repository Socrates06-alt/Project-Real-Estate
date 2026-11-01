import type { ReactNode } from "react";
import { Button } from "./ui/button";

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[28px] bg-surface px-6 py-12 text-center shadow-card">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-brand-soft text-brand">{icon}</div>
      <p className="font-bold">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-sub">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="rounded-[28px] bg-surface px-6 py-10 text-center shadow-card">
      <p className="font-semibold">Couldn't load</p>
      <p className="mt-1 text-sm text-sub">{message}</p>
      {retry && (
        <Button variant="soft" size="sm" className="mt-4" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
