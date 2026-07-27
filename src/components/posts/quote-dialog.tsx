"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComposeBox } from "@/components/posts/compose-box";
import type { PostWithAuthor } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";

export function QuoteDialog({
  open,
  onOpenChange,
  post,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post: PostWithAuthor;
  onSuccess?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 sm:rounded-3xl">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle>Quote post</DialogTitle>
        </DialogHeader>
        <div className="p-4">
          <div className="mb-3 rounded-2xl border border-border bg-muted/30 p-3">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <UserAvatar user={post.author} size="sm" />
              <span className="font-semibold">{post.author?.displayName}</span>
              <span className="text-muted-foreground">
                @{post.author?.username}
              </span>
            </div>
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {post.text || "Media post"}
            </p>
          </div>
          <ComposeBox
            quoteOfId={post.id}
            placeholder="Add a comment"
            autofocus
            onSuccess={() => {
              onOpenChange(false);
              onSuccess?.();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
