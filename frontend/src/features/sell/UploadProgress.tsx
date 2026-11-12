import { t } from "@/shared/i18n";
/** Upload progress bar shown while the property is being sent. */
export function UploadProgress({ progress }: { progress: number }) {
  return (
    <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("sell.uploadAria")}>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-center text-xs text-sub">
        {progress < 100 ? t("sell.uploadingDots", { pct: progress }) : t("sell.almostDone")} {t("sell.keepOpen")}
      </p>
    </div>
  );
}
