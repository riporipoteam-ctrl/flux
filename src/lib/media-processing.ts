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
      reject(new Error("The selected image could not be decoded."));
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
  const name = `${file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-") || "story"}.webp`;
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Flux could not read the processed image."));
    reader.readAsDataURL(file);
  });
}
