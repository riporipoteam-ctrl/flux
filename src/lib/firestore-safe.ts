/**
 * Firestore rejects `undefined` anywhere in document data.
 * Strip undefined recursively; keep null (valid) and empty strings.
 */
export function stripUndefined<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .filter((v) => v !== undefined)
      .map((v) => stripUndefined(v)) as T;
  }
  // Don't strip Timestamp / Date / FieldValue-like objects with special constructors
  const ctor = (value as object).constructor?.name;
  if (ctor && ctor !== "Object" && ctor !== "Array") {
    return value;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out as T;
}

/** Build socialLinks without undefined keys */
export function cleanSocialLinks(input: {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  x?: string;
  website?: string;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of ["instagram", "tiktok", "youtube", "x", "website"] as const) {
    const v = input[key]?.trim();
    if (v) out[key] = v;
  }
  return out;
}
