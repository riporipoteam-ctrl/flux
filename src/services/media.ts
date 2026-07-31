import { FirebaseError } from "firebase/app";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";

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
      : "Firebase Storage returned an unknown server error. Flux will use its image fallback for Stories when possible.";
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

export async function uploadImage(path: string, file: File): Promise<string> {
  if (!auth.currentUser) throw new Error("Sign in again before uploading media.");
  if (!file.size) throw new Error("The selected file is empty.");
  const storageRef = ref(storage, safeStoragePath(path));
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: {
      originalName: file.name.slice(0, 180),
      uploadedBy: auth.currentUser.uid,
    },
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        task.cancel();
        reject(new Error("The upload took longer than 60 seconds and was stopped."));
      }, 60_000);
      task.on(
        "state_changed",
        undefined,
        (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
        () => {
          window.clearTimeout(timeout);
          resolve();
        }
      );
    });
    return await getDownloadURL(task.snapshot.ref);
  } catch (error) {
    throw new Error(storageMessage(error));
  }
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  return uploadImage(`avatars/${uid}/${Date.now()}.${ext}`, file);
}

export async function uploadBanner(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  return uploadImage(`banners/${uid}/${Date.now()}.${ext}`, file);
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
