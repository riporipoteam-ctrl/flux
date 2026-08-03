import { FirebaseError } from "firebase/app";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { processProfileAvatar, processProfileBanner } from "@/lib/media-processing";

export type UploadProgress = (percent: number) => void;

function storageMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error ? error.message : "The upload failed for an unknown reason.";
  }
  if (error.code === "storage/unauthorized") {
    return "Firebase Storage rejected this upload. Sign in again and make sure the deployed Storage rules allow this media path.";
  }
  if (error.code === "storage/canceled") return "The upload was cancelled.";
  if (error.code === "storage/retry-limit-exceeded") return "The upload timed out. Check your connection and try again.";
  if (error.code === "storage/quota-exceeded") return "The Firebase Storage quota has been reached.";
  if (error.code === "storage/object-not-found") return "Firebase created no upload object. The configured Storage bucket may be wrong.";
  if (error.code === "storage/unknown") {
    const serverResponse = typeof error.customData?.serverResponse === "string" ? error.customData.serverResponse : "";
    return serverResponse
      ? `Firebase Storage returned an unknown server error: ${serverResponse.slice(0, 240)}`
      : "Firebase Storage returned an unknown server error. Check the connection and try again.";
  }
  return error.message || `Firebase upload failed (${error.code}).`;
}

function safeStoragePath(path: string): string {
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "file")
    .join("/");
}

function retryable(error: unknown): boolean {
  if (error instanceof FirebaseError) {
    return ["storage/unknown", "storage/retry-limit-exceeded", "storage/server-file-wrong-size"].includes(error.code);
  }
  return error instanceof Error && /network|timeout|offline|fetch/i.test(error.message);
}

async function uploadAttempt(path: string, file: File, onProgress?: UploadProgress): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Sign in again before uploading media.");
  if (!file.size) throw new Error("The selected file is empty.");
  await currentUser.getIdToken();

  const storageRef = ref(storage, safeStoragePath(path));
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    cacheControl: "public,max-age=31536000,immutable",
    customMetadata: {
      originalName: file.name.slice(0, 180),
      uploadedBy: currentUser.uid,
    },
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      task.cancel();
      reject(new Error("The upload took longer than 45 seconds and was stopped."));
    }, 45_000);
    task.on(
      "state_changed",
      (snapshot) => {
        const total = Math.max(1, snapshot.totalBytes);
        onProgress?.(Math.round((snapshot.bytesTransferred / total) * 100));
      },
      (error) => {
        globalThis.clearTimeout(timeout);
        reject(error);
      },
      () => {
        globalThis.clearTimeout(timeout);
        resolve();
      }
    );
  });
  onProgress?.(100);
  return getDownloadURL(task.snapshot.ref);
}

export async function uploadImage(path: string, file: File, onProgress?: UploadProgress): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await uploadAttempt(path, file, onProgress);
    } catch (error) {
      lastError = error;
      if (error instanceof FirebaseError && error.code === "storage/unauthorized" && auth.currentUser) {
        await auth.currentUser.getIdToken(true).catch(() => undefined);
      }
      if (!retryable(error) || attempt === 1) break;
      onProgress?.(0);
      await new Promise((resolve) => globalThis.setTimeout(resolve, 700));
    }
  }
  throw new Error(storageMessage(lastError));
}

export async function uploadAvatar(uid: string, file: File, onProgress?: UploadProgress): Promise<string> {
  const processed = await processProfileAvatar(file);
  return uploadImage(`avatars/${uid}/${Date.now()}-${crypto.randomUUID()}.webp`, processed.file, onProgress);
}

export async function uploadBanner(uid: string, file: File, onProgress?: UploadProgress): Promise<string> {
  const processed = await processProfileBanner(file);
  return uploadImage(`banners/${uid}/${Date.now()}-${crypto.randomUUID()}.webp`, processed.file, onProgress);
}

export async function uploadPostMedia(uid: string, postId: string, file: File, index: number): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  return uploadImage(`posts/${uid}/${postId}/${index}-${Date.now()}.${ext}`, file);
}

export async function uploadChatMedia(uid: string, conversationId: string, file: File): Promise<string> {
  if (file.size > 50 * 1024 * 1024) throw new Error("Chat files must be under 50 MB");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "file";
  return uploadImage(`chats/${conversationId}/${uid}/${Date.now()}-${safeName}`, file);
}

export function fileToMediaType(file: File): "image" | "video" | "gif" {
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("video/")) return "video";
  return "image";
}
