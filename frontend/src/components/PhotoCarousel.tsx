import { useRef, useState, type ReactNode } from "react";
import { Home, Trees } from "lucide-react";
import { mediaUrl, type PropertyType } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Swipeable, snap-scrolling photo strip with dots (Instagram-style). */
export function PhotoCarousel({
  photos,
  type,
  className,
  overlay,
  onOpen,
}: {
  photos: string[];
  type: PropertyType;
  className?: string;
  overlay?: ReactNode;
  onOpen?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const el = ref.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <div ref={ref} onScroll={onScroll} className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto">
        {photos.length ? (
          photos.map((src, i) => (
            <img
              key={src}
              src={mediaUrl(src)}
              alt={`Photo ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              onClick={onOpen}
              className="h-full w-full shrink-0 snap-center object-cover"
            />
          ))
        ) : (
          <Placeholder type={type} onClick={onOpen} />
        )}
      </div>
      {overlay}
      {photos.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <span key={i} className={cn("h-1.5 rounded-full bg-white/90 shadow transition-all", i === index ? "w-4" : "w-1.5 opacity-60")} />
          ))}
        </div>
      )}
    </div>
  );
}

function Placeholder({ type, onClick }: { type: PropertyType; onClick?: () => void }) {
  const Icon = type === "house" ? Home : Trees;
  return (
    <div onClick={onClick} className="grid h-full w-full shrink-0 place-items-center bg-brand-soft text-brand/60">
      <Icon size={56} strokeWidth={1.4} />
    </div>
  );
}
