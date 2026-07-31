"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileText,
  HeartHandshake,
  HelpCircle,
  Loader2,
  Lock,
  MessageCircle,
  Send,
  Shield,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createReport } from "@/services/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SupportMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const RULES = [
  { title: "Respect people", text: "No harassment, threats, hateful attacks, sexual exploitation, doxxing, or encouragement of self-harm." },
  { title: "Keep Flux safe", text: "Do not share malware, phishing links, stolen accounts, private information, or instructions meant to harm devices or people." },
  { title: "No spam or manipulation", text: "Do not flood posts, fake engagement, automate abusive traffic, impersonate others, or exploit Flux Coins and rewards." },
  { title: "Use creator tools responsibly", text: "Review generated games, websites, scripts, uploads and marketplace assets before publishing. Respect licenses and ownership." },
  { title: "Protect younger users", text: "Do not request sexual content from minors, groom users, or move unsafe conversations to another platform." },
  { title: "Report, do not retaliate", text: "Use reports for public content or specific messages. Admins review reported material; they do not receive unrestricted access to private chats." },
];

const FAQS = [
  { question: "Why can’t my camera or microphone start?", answer: "Open Flux over HTTPS, allow camera/microphone permissions in the browser, close other apps using the device, and restart the Live preview. Screen audio depends on the browser and the screen or tab you select." },
  { question: "How do AskAI limits reset?", answer: "AskAI uses a weekly counter. Free, Basic and Premium have different limits. The usage card in AskAI shows what is used and the next reset window." },
  { question: "Where are my Studio projects?", answer: "Studio drafts are currently stored on the device that created them. Publish a game to make it available through Flux Games and the shared Firestore catalog." },
  { question: "Why is multiplayer not active in my generated game?", answer: "Studio can mark projects as multiplayer-ready, but real network synchronization needs a room runtime or authoritative server. A generated HTML preview alone cannot safely provide server multiplayer." },
  { question: "How do Flux Premium purchases work?", answer: "Plans are bought with Flux Coins for 30 days. Premium unlocks higher AskAI usage, verification and creator reward benefits. The economy must be server-hardened before a high-value public launch." },
  { question: "How do I report content?", answer: "Use the report action on the post, user, group or message. Only reported messages should enter the admin review queue; normal private conversations stay private." },
];

export default function HelpPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([
    { id: "welcome", role: "assistant", text: "Hi — I’m Flux Support. Describe what is broken and I’ll suggest a fix. Say “human support” when you need the owner to review it." },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const humanRequested = useMemo(() => messages.some((item) => item.role === "assistant" && item.text.includes("support request was sent")), [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const userMessage: SupportMessage = { id: `u-${Date.now()}`, role: "user", text };
    setMessages((items) => [...items, userMessage]);
    setInput("");
    setSending(true);

    try {
      if (/\b(human|person|admin|owner|support ticket|real support)\b/i.test(text)) {
        if (!user) {
          setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "assistant", text: "Sign in first so the support request can be linked to your Flux account." }]);
          return;
        }
        const transcript = [...messages, userMessage].slice(-8).map((item) => `${item.role}: ${item.text}`).join("\n");
        await createReport({
          reporterId: user.uid,
          targetType: "user",
          targetId: user.uid,
          reason: "Human support requested",
          details: `Support request from ${profile?.displayName || user.email || user.uid}:\n${transcript}`.slice(0, 3500),
        });
        setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "assistant", text: "Your human support request was sent to the Flux owner’s Reports queue. You can keep adding details here, but send another request only when the situation changes." }]);
        toast.success("Support request sent");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "assistant", text: supportAnswer(text) }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support request failed";
      setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "assistant", text: `I couldn’t create the support request: ${message}` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f6f8] pb-24 text-[#111216] dark:bg-black dark:text-white">
      <header className="border-b border-black/6 bg-[#101216] px-4 py-11 text-white dark:border-white/10 sm:py-14">
        <div className="mx-auto max-w-6xl"><span className="grid h-13 w-13 place-items-center rounded-2xl bg-violet-500"><HeartHandshake className="h-6 w-6" /></span><h1 className="mt-6 text-4xl font-black leading-[.95] tracking-[-.06em] sm:text-6xl">Help, rules and support.</h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">Troubleshoot Flux, understand the community rules, or escalate a real issue to the owner without exposing everyone’s private messages.</p></div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 px-3 py-6 sm:px-5 sm:py-9 lg:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <section className="rounded-[28px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><Shield className="h-5 w-5" /></span><div><h2 className="text-2xl font-black tracking-tight">Flux community rules</h2><p className="text-xs text-muted-foreground">Applied to posts, Stories, Lives, games, profiles, groups and reported messages</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{RULES.map((rule, index) => <article key={rule.title} className="rounded-[22px] border border-border p-4"><span className="grid h-8 w-8 place-items-center rounded-xl bg-muted text-xs font-black">{index + 1}</span><h3 className="mt-4 font-black">{rule.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{rule.text}</p></article>)}</div><div className="mt-5 flex items-start gap-3 rounded-2xl bg-amber-500/10 p-4 text-amber-800 dark:text-amber-200"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p className="text-sm leading-6"><strong>Enforcement:</strong> content can be removed and accounts can be warned, timed out, or banned. Appeals and human support requests enter the owner’s review queue.</p></div></section>

          <section className="rounded-[28px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114] sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/12 text-blue-600"><HelpCircle className="h-5 w-5" /></span><h2 className="text-2xl font-black tracking-tight">Common questions</h2></div><div className="mt-5 divide-y divide-border">{FAQS.map((faq, index) => <button key={faq.question} type="button" onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full py-4 text-left"><span className="flex items-center gap-3"><span className="min-w-0 flex-1 font-black">{faq.question}</span><ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === index ? "rotate-180" : ""}`} /></span>{openFaq === index ? <span className="mt-3 block max-w-3xl text-sm leading-6 text-muted-foreground">{faq.answer}</span> : null}</button>)}</div></section>

          <section className="grid gap-3 sm:grid-cols-3"><InfoCard icon={Lock} title="Private by default" text="Normal DMs are not a general admin browsing surface." /><InfoCard icon={FileText} title="Reported evidence" text="Participants can escalate a specific harmful message or public item." /><InfoCard icon={UserRoundCheck} title="Human decision" text="The owner reviews reports and support requests before action." /></section>
        </div>

        <aside className="lg:sticky lg:top-5 lg:h-[calc(100dvh-2.5rem)]"><div className="flex h-[min(720px,calc(100dvh-2rem))] flex-col overflow-hidden rounded-[28px] border border-black/7 bg-white shadow-[0_24px_70px_rgba(0,0,0,.1)] dark:border-white/10 dark:bg-[#101114]"><div className="flex items-center gap-3 border-b border-border p-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-black text-white dark:bg-white dark:text-black"><Bot className="h-5 w-5" /></span><div className="min-w-0 flex-1"><h2 className="font-black">Flux Support</h2><p className="text-[10px] text-muted-foreground">Troubleshooting + human escalation</p></div>{humanRequested ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Sparkles className="h-5 w-5 text-violet-500" />}</div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">{messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><p className={`max-w-[88%] rounded-[20px] px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-foreground text-background" : "bg-muted"}`}>{message.text}</p></div>)}{sending ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking the support guide…</div> : null}</div><div className="border-t border-border p-3"><div className="flex gap-2"><Input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void send(); }} placeholder="Describe what is broken" className="h-11 rounded-full" /><Button size="icon" onClick={() => void send()} disabled={!input.trim() || sending} className="h-11 w-11 rounded-full"><Send className="h-4 w-4" /></Button></div><p className="mt-2 text-center text-[9px] text-muted-foreground">Say “human support” to send this context to the owner.</p></div></div></aside>
      </div>
    </main>
  );
}

function supportAnswer(text: string): string {
  const lower = text.toLowerCase();
  if (/camera|microphone|mic|screen share|screen audio|live/.test(lower)) return "Open Live Studio over HTTPS, choose Camera or Share Screen, allow browser permissions, and press Open Preview before Start Live. If viewers cannot connect on mobile networks, Flux needs TURN credentials or an SFU deployment.";
  if (/askai|ai|usage|limit|reset/.test(lower)) return "Open AskAI and check the usage card in the left panel. Search does not need a local model download. Creator and assistant actions use the weekly limit. The owner can reset a user or everyone from Admin.";
  if (/studio|game|website|publish|marketplace/.test(lower)) return "Open Flux Studio, generate or edit the project, test it in desktop/tablet/phone preview, save it, then publish games to Flux Games. Marketplace items are open-source references; verify the displayed source license before shipping.";
  if (/story|stories|viewer|views/.test(lower)) return "Create Stories from the Story editor. Owners can see unique viewers through the viewer list. If uploads fail, use an image or video under 40 MB and confirm Firebase Storage is configured.";
  if (/premium|basic|coins|verified|reward/.test(lower)) return "Plans are bought with Flux Coins from the Premium page. Rewards can be claimed daily from Flux Rewards. This economy is suitable for testing, but trusted server-side validation is still required before high-value public use.";
  if (/ban|warning|report|harass|abuse|threat/.test(lower)) return "Use the report action on the specific post, profile, group or message. For urgent account help, say “human support” and I’ll create a review item for the owner.";
  return "I couldn’t match that to a known troubleshooting path. Tell me which page you are on, what you clicked, and the exact error or behavior. Say “human support” when the owner needs to review it.";
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof Lock; title: string; text: string }) { return <div className="rounded-[22px] border border-black/7 bg-white p-5 dark:border-white/10 dark:bg-[#101114]"><Icon className="h-5 w-5 text-violet-500" /><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></div>; }
