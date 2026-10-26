// Bulk student-photo import helpers (StudentManager's "import photos from a folder" button).

// Backend limit for uploadStudentPhoto (`max:500` KB) - same ceiling StudentPhotoDialog targets.
export const MAX_IMPORT_PHOTO_BYTES = 500 * 1024;

const JPEG_QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.25];
// Each time even the lowest quality is still too big, the image is scaled down by this factor.
const SHRINK_FACTOR = 0.8;
const MAX_SHRINK_ROUNDS = 8;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg"];

// "12.PNG" -> 12. Returns null for anything that isn't `<positive integer>.<png|jpg|jpeg>`
// (case-insensitive), so unrelated files in the chosen folder are simply ignored.
export const parsePhotoFileNumber = (fileName: string): number | null => {
  const match = /^(\d+)\.([A-Za-z]+)$/.exec(fileName.trim());
  if (!match || !IMAGE_EXTENSIONS.includes(match[2].toLowerCase())) {
    return null;
  }
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unreadable image"));
    };
    img.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));

// Returns a blob that satisfies the backend's size limit. A JPEG already under the limit is
// uploaded untouched; anything else (a PNG, or a file over 500 KB) is re-encoded as JPEG - first by
// lowering quality, then, if that's still too big, by scaling the image down - until it fits.
// Resolves null if the file can't be read as an image or can't be shrunk enough.
export const preparePhotoForUpload = async (file: File): Promise<Blob | null> => {
  const isJpeg = /\.jpe?g$/i.test(file.name);
  if (isJpeg && file.size <= MAX_IMPORT_PHOTO_BYTES) {
    return file;
  }
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return null;
  }
  let width = img.naturalWidth;
  let height = img.naturalHeight;
  for (let round = 0; round <= MAX_SHRINK_ROUNDS; round++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    // JPEG has no alpha channel: paint white first so transparent PNG areas don't turn black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of JPEG_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= MAX_IMPORT_PHOTO_BYTES) {
        return blob;
      }
    }
    width *= SHRINK_FACTOR;
    height *= SHRINK_FACTOR;
  }
  return null;
};
