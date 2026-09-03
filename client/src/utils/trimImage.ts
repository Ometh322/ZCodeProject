/**
 * Trims fully-transparent margins off a PNG (or any raster image with an
 * alpha channel), right in the browser.
 *
 * Why: designers often export logos with generous transparent padding, so the
 * visible artwork occupies a small fraction of the file. Rendered as-is, that
 * padding eats screen space and the logo looks tiny.
 *
 * How: draw the image on a canvas, scan the alpha channel for the bounding box
 * of non-transparent pixels, then copy just that box to a fresh canvas and
 * re-encode as PNG. Falls back to the original file when anything fails or
 * when there is nothing to trim (e.g. a fully opaque JPEG).
 */

/** Alpha threshold: pixels below this count as transparent. */
const ALPHA_THRESHOLD = 8;

export async function trimTransparent(file: File): Promise<File> {
  // Only PNG/WebP reliably carry alpha; skip anything else untouched.
  if (file.type !== "image/png" && file.type !== "image/webp") return file;

  try {
    const img = await createImageBitmap(file);

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);

    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;

    // Bounding box of pixels above the alpha threshold.
    let minX = width,
      minY = height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > ALPHA_THRESHOLD) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Nothing visible (fully transparent image?) or no padding to trim.
    if (maxX < minX || maxY < minY) return file;
    if (minX === 0 && minY === 0 && maxX === width - 1 && maxY === height - 1) {
      return file;
    }

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    const trimmed = document.createElement("canvas");
    trimmed.width = w;
    trimmed.height = h;
    trimmed.getContext("2d")!.drawImage(canvas, minX, minY, w, h, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((res) =>
      trimmed.toBlob(res, "image/png"),
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}-trimmed.png`, { type: "image/png" });
  } catch {
    // Corrupt image, unsupported browser API, canvas tainted — use original.
    return file;
  }
}
