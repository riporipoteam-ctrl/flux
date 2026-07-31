import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { FluxAgent, FluxPlanTier, UserProfile } from "@/types";

export interface FluxPlanDefinition {
  id: FluxPlanTier;
  name: string;
  price: number;
  askAILimit: number;
  color: string;
  features: string[];
}

export const FLUX_PLANS: Record<FluxPlanTier, FluxPlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    askAILimit: 20,
    color: "#737373",
    features: ["20 AskAI requests weekly", "Play and publish community games", "Stories, posts, gifts and live viewing"],
  },
  basic: {
    id: "basic",
    name: "Basic",
    price: 12_500,
    askAILimit: 100,
    color: "#6d5dfc",
    features: ["100 AskAI requests weekly", "Create public stickers", "Animated avatar and banner", "Extra Studio project slots"],
  },
  premium: {
    id: "premium",
    name: "Premium",
    price: 35_000,
    askAILimit: 500,
    color: "#ffb000",
    features: ["500 AskAI requests weekly", "Verified Flux badge", "Creator Rewards multiplier", "Custom profile badges", "Maximum Studio and agent limits"],
  },
};

function timestampMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null) {
    if ("toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
    if ("toDate" in value && typeof value.toDate === "function") return value.toDate().getTime();
  }
  return 0;
}

export function activePlan(profile: UserProfile | null | undefined): FluxPlanTier {
  if (!profile) return "free";
  if (profile.planTier === "free") return "free";
  const expires = timestampMs(profile.planExpiresAt);
  return !expires || expires > Date.now() ? profile.planTier : "free";
}

export function usagePercent(profile: UserProfile | null | undefined): number {
  const used = Number(profile?.askAIUsage?.used || 0);
  const limit = Math.max(1, Number(profile?.askAIUsage?.limit || FLUX_PLANS.free.askAILimit));
  return Math.min(100, Math.round((used / limit) * 100));
}

export async function consumeAskAIRequest(uid: string): Promise<{ used: number; limit: number; resetAt: Date }> {
  const userRef = doc(db, "users", uid);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error("Flux profile not found");
    const data = snap.data();
    const tier: FluxPlanTier = data.planTier === "premium" || data.planTier === "basic" ? data.planTier : "free";
    const plan = FLUX_PLANS[tier];
    const previousReset = timestampMs(data.askAIUsage?.resetAt);
    const expired = !previousReset || previousReset <= Date.now();
    const used = expired ? 0 : Number(data.askAIUsage?.used || 0);
    if (used >= plan.askAILimit) {
      const reset = new Date(expired ? Date.now() + 7 * 24 * 60 * 60 * 1000 : previousReset);
      throw new Error(`AskAI limit reached. It resets ${reset.toLocaleString()}.`);
    }
    const resetAt = new Date(expired ? Date.now() + 7 * 24 * 60 * 60 * 1000 : previousReset);
    const next = used + 1;
    transaction.update(userRef, {
      askAIUsage: { used: next, limit: plan.askAILimit, resetAt },
      updatedAt: serverTimestamp(),
    });
    return { used: next, limit: plan.askAILimit, resetAt };
  });
}

export async function purchaseFluxPlan(uid: string, tier: Exclude<FluxPlanTier, "free">): Promise<void> {
  const plan = FLUX_PLANS[tier];
  const userRef = doc(db, "users", uid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error("Flux profile not found");
    const coins = Number(snap.data().coins || 0);
    if (coins < plan.price) throw new Error(`You need ${plan.price.toLocaleString()} Flux Coins.`);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const update: Record<string, unknown> = {
      coins: coins - plan.price,
      planTier: tier,
      planExpiresAt: expiresAt,
      askAIUsage: {
        used: 0,
        limit: plan.askAILimit,
        resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      updatedAt: serverTimestamp(),
    };
    if (tier === "premium") {
      update.isVerified = true;
      update.verifiedType = "flux";
    }
    transaction.update(userRef, update);
  });
}

export async function claimCreatorReward(uid: string): Promise<number> {
  const userRef = doc(db, "users", uid);
  const today = new Date().toISOString().slice(0, 10);
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) throw new Error("Flux profile not found");
    const data = snap.data();
    if (data.lastRewardClaimKey === today) throw new Error("Today’s creator reward is already claimed.");
    const tier: FluxPlanTier = data.planTier === "premium" || data.planTier === "basic" ? data.planTier : "free";
    const base = 50 + Math.min(500, Number(data.postsCount || 0) * 4 + Number(data.likesCount || 0));
    const multiplier = tier === "premium" ? 2 : tier === "basic" ? 1.25 : 1;
    const reward = Math.floor(base * multiplier);
    transaction.update(userRef, {
      coins: Number(data.coins || 0) + reward,
      lastRewardClaimKey: today,
      updatedAt: serverTimestamp(),
    });
    return reward;
  });
}

export async function saveFluxAgent(uid: string, input: { name: string; instructions: string }): Promise<FluxAgent> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Flux profile not found");
  const tier: FluxPlanTier = snap.data().planTier === "premium" || snap.data().planTier === "basic" ? snap.data().planTier : "free";
  const maximum = tier === "premium" ? 10 : tier === "basic" ? 4 : 1;
  const agents = (Array.isArray(snap.data().aiAgents) ? snap.data().aiAgents : []) as FluxAgent[];
  if (agents.length >= maximum) throw new Error(`${FLUX_PLANS[tier].name} supports ${maximum} agent${maximum === 1 ? "" : "s"}.`);
  const agent: FluxAgent = {
    id: `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim().slice(0, 40) || "Flux Agent",
    instructions: input.instructions.trim().slice(0, 1200),
    status: "idle",
    currentTask: null,
    createdAt: Date.now(),
  };
  await updateDoc(ref, { aiAgents: [...agents, agent].slice(-maximum), updatedAt: serverTimestamp() });
  return agent;
}

export async function updateFluxAgentTask(uid: string, agentId: string, task: string): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Flux profile not found");
  const agents = ((snap.data().aiAgents || []) as FluxAgent[]).map((agent) =>
    agent.id === agentId
      ? { ...agent, status: task.trim() ? "working" as const : "idle" as const, currentTask: task.trim().slice(0, 500) || null }
      : agent
  );
  await updateDoc(ref, { aiAgents: agents, updatedAt: serverTimestamp() });
}