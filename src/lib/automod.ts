export type AutoModSurface = "post" | "story" | "live" | "message" | "group" | "game";

export interface AutoModResult {
  allowed: boolean;
  severity: "none" | "warning" | "blocked";
  reasons: string[];
  score: number;
}

const SEVERE_PATTERNS: Array<{ pattern: RegExp; reason: string; score: number }> = [
  { pattern: /\b(?:i(?:'m| am)?\s+going\s+to|i(?:'ll| will))\s+(?:kill|shoot|stab|bomb|rape)\s+(?:you|him|her|them)\b/i, reason: "credible threat", score: 100 },
  { pattern: /\b(?:send|show|share|trade)\s+(?:nudes?|sexual\s+(?:pics?|videos?))\b.*\b(?:minor|child|kid|underage|1[0-7]\s*(?:yo|years? old))\b/i, reason: "sexual exploitation involving a minor", score: 100 },
  { pattern: /\b(?:doxx?|leak)\s+(?:your|his|her|their)\s+(?:address|phone|school|location)\b/i, reason: "doxxing threat", score: 95 },
  { pattern: /\b(?:download|run|install)\b.{0,40}\b(?:stealer|ransomware|keylogger|token grabber|rat malware)\b/i, reason: "malware distribution", score: 95 },
  { pattern: /\b(?:give|send)\s+me\s+(?:your\s+)?(?:password|login code|2fa code|recovery code|session token)\b/i, reason: "credential theft", score: 90 },
];

const ABUSE_PATTERNS: Array<{ pattern: RegExp; reason: string; score: number }> = [
  { pattern: /\b(?:fuck|fucking|bitch|cunt|retard(?:ed)?|whore)\b/i, reason: "abusive language", score: 45 },
  { pattern: /\b(?:kys|kill yourself|go die)\b/i, reason: "self-harm harassment", score: 85 },
  { pattern: /\b(?:you are|you're|ur)\s+(?:worthless|disgusting|a loser|trash)\b/i, reason: "targeted harassment", score: 55 },
];

function normalized(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[0@]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/(.)\1{3,}/g, "$1$1$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function evaluateContent(text: string, surface: AutoModSurface): AutoModResult {
  const clean = normalized(text);
  if (!clean) return { allowed: true, severity: "none", reasons: [], score: 0 };

  const reasons: string[] = [];
  let score = 0;
  for (const rule of SEVERE_PATTERNS) {
    if (!rule.pattern.test(clean)) continue;
    reasons.push(rule.reason);
    score = Math.max(score, rule.score);
  }
  for (const rule of ABUSE_PATTERNS) {
    if (!rule.pattern.test(clean)) continue;
    reasons.push(rule.reason);
    score = Math.max(score, rule.score);
  }

  const links = clean.match(/https?:\/\/\S+/g) || [];
  if (links.length >= 4) {
    reasons.push("excessive links");
    score = Math.max(score, 65);
  }
  if (/\b(?:free robux|free nitro|verify your account|claim reward)\b/i.test(clean) && links.length) {
    reasons.push("likely phishing or scam promotion");
    score = Math.max(score, 85);
  }
  if (/(.{8,})\1{2,}/i.test(clean) || clean.split(" ").length > 18 && new Set(clean.split(" ")).size < 5) {
    reasons.push("repetitive spam");
    score = Math.max(score, 60);
  }

  // Private messages are not stored in a general admin moderation feed. The same
  // preflight blocks severe abuse locally while participant reports remain the
  // only path that exposes a specific message to review.
  const blockThreshold = surface === "message" ? 80 : 55;
  const allowed = score < blockThreshold;
  return {
    allowed,
    severity: allowed ? (score > 0 ? "warning" : "none") : "blocked",
    reasons: [...new Set(reasons)],
    score,
  };
}

export function assertContentAllowed(text: string, surface: AutoModSurface): AutoModResult {
  const result = evaluateContent(text, surface);
  if (!result.allowed) {
    const reason = result.reasons.length ? result.reasons.join(", ") : "community-safety rules";
    throw new Error(`Flux AutoMod blocked this ${surface}: ${reason}. Edit the wording or contact support if this was a mistake.`);
  }
  return result;
}
