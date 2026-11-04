/** Upload progress bar shown while the property is being sent. */
export function UploadProgress({ progress }: { progress: number }) {
  return (
    <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-brand transition-[width] duration-200" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1.5 text-center text-xs text-sub">
        {progress < 100 ? `Uploading… ${progress}%` : "Almost done…"} Please keep this page open.
      </p>
    </div>
  );
}
