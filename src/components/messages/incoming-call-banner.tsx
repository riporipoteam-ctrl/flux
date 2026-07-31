"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { getUser } from "@/services/users";
import { setCallStatus, subscribeIncomingCalls, type FluxCall } from "@/services/calls";
import type { UserProfile } from "@/types";
import { UserAvatar } from "@/components/shared/user-avatar";

export function IncomingCallBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const [call, setCall] = useState<FluxCall | null>(null);
  const [caller, setCaller] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeIncomingCalls(user.uid, (calls) => setCall(calls[0] || null));
  }, [user]);

  useEffect(() => {
    if (!call) {
      setCaller(null);
      return;
    }
    void getUser(call.callerId).then(setCaller);
  }, [call]);

  if (!call) return null;

  return (
    <div className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[2147483000] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-popover p-3 shadow-2xl">
      <UserAvatar user={caller} size="sm" clickable={false} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{caller?.displayName || "Flux friend"}</p>
        <p className="text-xs text-muted-foreground">Incoming {call.mode} call</p>
      </div>
      <button type="button" onClick={() => void setCallStatus(call.id, "declined")} className="grid h-10 w-10 place-items-center rounded-full bg-red-500 text-white" aria-label="Decline call">
        <PhoneOff className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => router.push(`/messages/call?call=${call.id}`)} className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white" aria-label="Answer call">
        {call.mode === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
      </button>
    </div>
  );
}
