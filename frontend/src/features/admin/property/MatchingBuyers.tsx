import { Link } from "react-router-dom";
import { MessageCircle, Phone, Sparkles } from "lucide-react";
import { useAsync } from "@/shared/lib/useAsync";
import { useAdmin } from "@/features/admin/auth";

type Match = { id: string; name: string; phones: string[]; area: string; notes: string; reasons: string[] };

/** Buyers this property may suit (type, wanted area, similar needs), so the right people get a call. */
export function MatchingBuyers({ propertyId }: { propertyId: string }) {
  const { call } = useAdmin();
  const { data } = useAsync(() => call<Match[]>(`/properties/${propertyId}/matches`), [propertyId]);
  if (!data?.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 px-1 font-semibold">
        <Sparkles size={17} className="text-brand" /> Matching buyers · {data.length}
      </h2>
      {data.map((b) => (
        <div key={b.id} className="card p-3.5">
          <div className="flex items-center justify-between gap-3">
            <Link to="/admin/buyers" className="min-w-0">
              <p className="truncate font-semibold">{b.name}</p>
              <p className="truncate text-xs text-sub">{b.reasons.join(" · ")}</p>
            </Link>
            {b.phones[0] && (
              <div className="flex shrink-0 gap-2">
                <a href={`tel:${b.phones[0]}`} aria-label={`Call ${b.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-surface shadow-[0_0_0_1px_var(--hairline)]">
                  <Phone size={17} className="text-brand" />
                </a>
                <a href={`https://wa.me/${b.phones[0].replace(/\D/g, "")}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${b.name}`} className="grid h-10 w-10 place-items-center rounded-full bg-wa text-white">
                  <MessageCircle size={17} />
                </a>
              </div>
            )}
          </div>
          {b.notes && <p className="mt-1.5 line-clamp-2 text-sm text-sub">{b.notes}</p>}
        </div>
      ))}
    </section>
  );
}
