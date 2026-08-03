export interface ProcessedImage {
  file: File;
  width: number;
  height: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The selected image could not be decoded. Try a JPEG, PNG or WebP image."));
    };
    image.src = url;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Flux could not process this image."));
    }, type, quality);
  });
}

function safeBaseName(name: string, fallback: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || fallback;
}

async function cropImage(
  file: File,
  options: { width: number; height: number; quality?: number; maxBytes?: number; fallbackName: string }
): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (!file.size) throw new Error("The selected image is empty.");
  if (file.size > 30 * 1024 * 1024) throw new Error("Images must be under 30 MB before processing.");

  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  canvas.width = options.width;
  canvas.height = options.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Flux could not prepare the image canvas.");

  const targetRatio = options.width / options.height;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;
  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, options.width, options.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, options.width, options.height);

  const maxBytes = options.maxBytes ?? 1_500_000;
  const qualities = [options.quality ?? 0.86, 0.76, 0.66, 0.56];
  let blob: Blob | null = null;
  for (const quality of qualities) {
    blob = await canvasBlob(canvas, "image/webp", quality);
    if (blob.size <= maxBytes) break;
  }
  if (!blob) throw new Error("Flux could not encode this image.");

  return {
    file: new File([blob], `${safeBaseName(file.name, options.fallbackName)}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    }),
    width: options.width,
    height: options.height,
  };
}

export async function processProfileAvatar(file: File): Promise<ProcessedImage> {
  return cropImage(file, { width: 512, height: 512, quality: 0.86, maxBytes: 900_000, fallbackName: "avatar" });
}

export async function processProfileBanner(file: File): Promise<ProcessedImage> {
  return cropImage(file, { width: 1500, height: 500, quality: 0.84, maxBytes: 2_400_000, fallbackName: "banner" });
}

export async function processStoryImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {}
): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files can be processed as Story images.");
  }
  const image = await loadImage(file);
  const maxDimension = options.maxDimension ?? 1920;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Flux could not prepare the Story canvas.");
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasBlob(canvas, "image/webp", options.quality ?? 0.84);
  const name = `${safeBaseName(file.name, "story")}.webp`;
  return { file: new File([blob], name, { type: "image/webp", lastModified: Date.now() }), width, height };
}

export async function imageToFirestoreFallback(file: File): Promise<string> {
  const attempts = [
    { maxDimension: 1280, quality: 0.72 },
    { maxDimension: 1080, quality: 0.62 },
    { maxDimension: 900, quality: 0.52 },
    { maxDimension: 720, quality: 0.44 },
  ];

  for (const attempt of attempts) {
    const processed = await processStoryImage(file, attempt);
    if (processed.file.size > 620_000) continue;
    const dataUrl = await fileToDataUrl(processed.file);
    if (dataUrl.length < 850_000) return dataUrl;
  }
  throw new Error("This image is too large for the emergency Story fallback. Choose a smaller image or try again after Storage is restored.");
}

export async function studioThumbnailToDataUrl(file: File): Promise<string> {
  const processed = await cropImage(file, { width: 960, height: 540, quality: 0.76, maxBytes: 420_000, fallbackName: "thumbnail" });
  return fileToDataUrl(processed.file);
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Flux could not read the processed image."));
    reader.readAsDataURL(file);
  });
}
