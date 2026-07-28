const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Prefix local public assets when Flux is hosted below a domain subpath. */
export function assetUrl(src: string): string {
  if (
    !src ||
    !basePath ||
    !src.startsWith("/") ||
    src.startsWith("//") ||
    src === basePath ||
    src.startsWith(`${basePath}/`)
  ) {
    return src;
  }

  return `${basePath}${src}`;
}

