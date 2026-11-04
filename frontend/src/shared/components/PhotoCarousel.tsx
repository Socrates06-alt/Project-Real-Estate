import { TYPE_ICON } from "@/shared/lib/propertyType";
import { useRef, useState, type ReactNode } from "react";
import { mediaUrl, type PropertyType } from "@/shared/api/client";
import { cn } from "@/shared/lib/utils";

/** Swipeable, snap-scrolling photo strip with dots (Instagram-style). */
export function PhotoCarousel({
  photos,
  type,
  className,
  overlay,
  onOpen,
  small,
}: {
  photos: string[];
  /** Use the light card-size copy (falls back to the full photo if missing). */
  small?: boolean;
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
            <Photo key={src} src={src} small={small} alt={`Photo ${i + 1}`} eager={i === 0} onClick={onOpen} />
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
  const Icon = TYPE_ICON[type];
  return (
    <div onClick={onClick} className="grid h-full w-full shrink-0 place-items-center bg-brand-soft text-brand/60">
      <Icon size={56} strokeWidth={1.4} />
    </div>
  );
}

/** Card-size copy of a published photo: ".../abc.webp" -> ".../abc-sm.webp". */
const smallUrl = (src: string) => src.replace(/\.webp$/, "-sm.webp");

/** A photo that fades in when loaded (soft placeholder meanwhile). */
function Photo({ src, small, alt, eager, onClick }: { src: string; small?: boolean; alt: string; eager: boolean; onClick?: () => void }) {
  const [url, setUrl] = useState(mediaUrl(small ? smallUrl(src) : src));
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={url}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onClick={onClick}
      onLoad={() => setLoaded(true)}
      onError={() => small && url !== mediaUrl(src) && setUrl(mediaUrl(src))}
      className={cn("h-full w-full shrink-0 snap-center object-cover transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
    />
  );
}
