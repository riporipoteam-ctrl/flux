import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

export async function uploadImage(
  path: string,
  file: File
): Promise<string> {
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, {
    contentType: file.type || "application/octet-stream",
    customMetadata: { originalName: file.name },
  });
  return getDownloadURL(storageRef);
}

export async function uploadAvatar(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  return uploadImage(`avatars/${uid}/${Date.now()}.${ext}`, file);
}

export async function uploadBanner(uid: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  return uploadImage(`banners/${uid}/${Date.now()}.${ext}`, file);
}

export async function uploadPostMedia(
  uid: string,
  postId: string,
  file: File,
  index: number
): Promise<string> {
  const ext = file.name.split(".").pop() || "jpg";
  return uploadImage(`posts/${uid}/${postId}/${index}-${Date.now()}.${ext}`, file);
}

export async function uploadChatMedia(
  uid: string,
  conversationId: string,
  file: File
): Promise<string> {
  if (file.size > 50 * 1024 * 1024) throw new Error("Chat files must be under 50 MB");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-100) || "file";
  return uploadImage(`chats/${conversationId}/${uid}/${Date.now()}-${safeName}`, file);
}

export function fileToMediaType(file: File): "image" | "video" | "gif" {
  if (file.type === "image/gif") return "gif";
  if (file.type.startsWith("video/")) return "video";
  return "image";
}
