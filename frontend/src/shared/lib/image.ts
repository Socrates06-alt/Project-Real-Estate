/**
 * Shrink a phone photo before upload: longest side 1600 px, JPEG ~82%.
 * A 4–6 MB camera photo becomes ~300–500 KB, so uploads on mobile data take seconds, not a minute.
 * Drawing to a canvas also drops EXIF (incl. GPS); the server still sanitizes every photo anyway.
 * If anything fails (old browser, odd file), the original is used.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#fff"; // PNGs with transparency
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}
