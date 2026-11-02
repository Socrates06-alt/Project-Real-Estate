import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { api, ApiError, getConfig, type Listing } from "@/lib/api";
import { removeSaved, useSavedIds } from "@/lib/saved";
import { useAsync } from "@/lib/useAsync";
import { ListingCard, ListingCardSkeleton } from "@/components/ListingCard";
import { EmptyState } from "@/components/States";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";

/** Shortlist: properties saved on this phone, to compare with family. */
export default function Saved() {
  const ids = useSavedIds();
  const config = useAsync(getConfig, []);
  const [items, setItems] = useState<Record<string, Listing>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const missing = ids.filter((id) => !items[id]);
    if (!missing.length) return setLoading(false);
    setLoading(true);
    Promise.all(
      missing.map((id) =>
        api<Listing>(`/api/listings/${id}`).catch((e) => {
          if (e instanceof ApiError && e.status === 404) removeSaved(id); // no longer listed
          return null;
        }),
      ),
    ).then((found) => {
      if (!alive) return;
      setItems((cur) => ({ ...cur, ...Object.fromEntries(found.filter(Boolean).map((l) => [l!.id, l!])) }));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  const list = ids.map((id) => items[id]).filter(Boolean);
  const contact = config.data?.contact;

  return (
    <div className="space-y-4">
      <PageHeader title="Saved" subtitle={list.length > 0 ? `${list.length} saved on this phone · tap ♥ to remove` : undefined} />
      {loading && !list.length && ids.length > 0 && <ListingCardSkeleton />}
      {!ids.length && (
        <EmptyState
          icon={<Heart size={28} />}
          title="Nothing saved yet"
          text="Tap the ♥ on any property to keep it here and compare later."
          action={
            <Link to="/" className={buttonVariants({ size: "sm" })}>
              Browse properties
            </Link>
          }
        />
      )}
      {contact && list.map((l) => <ListingCard key={l.id} listing={l} contact={contact} rera={config.data?.rera_number} />)}
    </div>
  );
}
