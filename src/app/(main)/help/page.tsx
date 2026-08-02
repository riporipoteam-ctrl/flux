"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  FileText,
  HeartHandshake,
  HelpCircle,
  Lock,
  Send,
  Shield,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import { createReport } from "@/services/admin";
import { Reveal, XCard, XHeader, XPage, XSectionTitle, XSwitch, XTabs } from "@/components/x/x-ui";
import { cn } from "@/lib/utils";

interface SupportMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const RULES = [
  { title: "Respect people", text: "No harassment, threats, hateful attacks, sexual exploitation, doxxing, or encouragement of self-harm." },
  { title: "Keep Flux safe", text: "No malware, phishing, stolen accounts, private information, or instructions meant to harm devices or people." },
  { title: "No spam or manipulation", text: "No post flooding, fake engagement, abusive automation, impersonation, or exploiting Flux Coins." },
  { title: "Use creator tools responsibly", text: "Review generated games, sites, scripts and uploads before publishing. Respect licenses and ownership." },
  { title: "Protect younger users", text: "Never request sexual content from minors, groom users, or move unsafe conversations off-platform." },
  { title: "Report, do not retaliate", text: "Reports cover public content and specific messages. Admins do not get blanket access to private chats." },
];

const FAQS = [
  { question: "Why can't my camera or microphone start?", answer: "Open Flux over HTTPS, allow camera/microphone permissions, close other apps using the device, and restart the Live preview. Screen audio depends on the browser and the tab you pick." },
  { question: "How do AskAI limits reset?", answer: "AskAI uses a weekly counter that differs per plan. The usage card in AskAI shows what is used and when the window resets." },
  { question: "Where are my Studio projects?", answer: "Studio drafts live on the device that created them. Publish a game to move it into Flux Games and the shared catalog." },
  { question: "Why is multiplayer not active in my generated game?", answer: "Studio can mark a project multiplayer-ready, but live sync needs a room runtime or authoritative server — a generated HTML preview alone cannot provide it." },
  { question: "How do Flux Premium purchases work?", answer: "Plans are bought with Flux Coins for 30 days and unlock higher AskAI usage, verification and reward benefits." },
  { question: "How do I report content?", answer: "Use the report action on the post, user, group or message. Only reported messages enter the admin queue; normal conversations stay private." },
];

const GUARANTEES = [
  { icon: Lock, title: "Private by default", text: "Normal DMs are not an admin browsing surface." },
  { icon: FileText, title: "Reported evidence only", text: "Participants escalate one harmful item at a time." },
  { icon: UserRoundCheck, title: "Human decision", text: "The owner reviews reports before any action." },
];

type Tab = "rules" | "faq" | "support";

export default function HelpPage() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>("rules");
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Hi — I'm Flux Support. Describe what is broken and I'll suggest a fix. Say “human support” when you need the owner to review it.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const humanRequested = useMemo(
    () => messages.some((item) => item.role === "assistant" && item.text.includes("support request was sent")),
    [messages]
  );

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
          setMessages((items) => [
            ...items,
            { id: `a-${Date.now()}`, role: "assistant", text: "Sign in first so the support request can be linked to your Flux account." },
          ]);
          return;
        }
        const transcript = [...messages, userMessage]
          .slice(-8)
          .map((item) => `${item.role}: ${item.text}`)
          .join("\n");
        await createReport({
          reporterId: user.uid,
          targetType: "user",
          targetId: user.uid,
          reason: "Human support requested",
          details: `Support request from ${profile?.displayName || user.email || user.uid}:\n${transcript}`.slice(0, 3500),
        });
        setMessages((items) => [
          ...items,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: "Your human support request was sent to the Flux owner's Reports queue. Keep adding details here, but only send another request when the situation changes.",
          },
        ]);
        toast.success("Support request sent");
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "assistant", text: supportAnswer(text) }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Support request failed";
      setMessages((items) => [...items, { id: `a-${Date.now()}`, role: "assistant", text: `I couldn't create the support request: ${message}` }]);
    } finally {
      setSending(false);
      window.requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  };

  return (
    <XPage>
      <XHeader title="Help" subtitle="Rules, answers and human support" icon={HeartHandshake} hideOnMobile />

      <XTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "rules", label: "Rules" },
          { id: "faq", label: "FAQ" },
          { id: "support", label: "Support" },
        ]}
      />

      <XSwitch id={tab}>
        {tab === "rules" ? (
          <>
            <section className="x-hero">
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--v8-accent)]">Community</p>
              <h1>Rules that keep Flux worth using.</h1>
              <p>Applied to posts, Stories, Lives, games, profiles, groups and anything reported.</p>
            </section>

            <div className="grid gap-3 p-4">
              {RULES.map((rule, index) => (
                <Reveal key={rule.title} delay={index * 0.03}>
                  <XCard className="flex gap-3 p-4">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--v8-panel-3)] text-xs font-black">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black">{rule.title}</h3>
                      <p className="mt-1.5 text-[13px] leading-5 text-[var(--v8-muted)]">{rule.text}</p>
                    </div>
                  </XCard>
                </Reveal>
              ))}

              <XCard className="flex gap-3 p-4" style={{ borderColor: "var(--v8-orange)", background: "color-mix(in srgb, var(--v8-orange) 8%, transparent)" }}>
                <AlertTriangle className="h-5 w-5 flex-none text-[var(--v8-orange)]" />
                <p className="text-[13px] leading-5">
                  <b>Enforcement:</b> content can be removed and accounts warned, timed out or banned. Appeals and human
                  support requests enter the owner&apos;s review queue.
                </p>
              </XCard>
            </div>

            <XSectionTitle>Your privacy guarantees</XSectionTitle>
            <div className="grid gap-3 px-4">
              {GUARANTEES.map(({ icon: Icon, title, text }) => (
                <XCard key={title} className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--v8-green-soft)] text-[var(--v8-green)]">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-black">{title}</h3>
                    <p className="text-[13px] leading-5 text-[var(--v8-muted)]">{text}</p>
                  </div>
                </XCard>
              ))}
            </div>
          </>
        ) : null}

        {tab === "faq" ? (
          <div className="p-4">
            <XCard>
              {FAQS.map((faq, index) => {
                const open = openFaq === index;
                return (
                  <div key={faq.question} className="border-b border-[var(--v8-line)] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : index)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[var(--v8-panel-2)]"
                    >
                      <HelpCircle className="h-[18px] w-[18px] flex-none text-[var(--v8-accent)]" />
                      <span className="min-w-0 flex-1 text-sm font-bold">{faq.question}</span>
                      <ChevronDown className={cn("h-4 w-4 flex-none transition-transform duration-200", open && "rotate-180")} />
                    </button>
                    <div
                      className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
                      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                    >
                      <div className="min-h-0">
                        <p className="px-4 pb-4 pl-[46px] text-[13px] leading-6 text-[var(--v8-muted)]">{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </XCard>
          </div>
        ) : null}

        {tab === "support" ? (
          <div className="p-4">
            <XCard className="flex h-[min(640px,calc(100dvh-220px))] flex-col overflow-hidden">
              <div className="flex flex-none items-center gap-3 border-b border-[var(--v8-line)] p-4">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--v8-text)] text-[var(--v8-panel)]">
                  <Bot className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-black">Flux Support</h2>
                  <p className="text-[11px] text-[var(--v8-muted)]">Troubleshooting + human escalation</p>
                </div>
                {humanRequested ? (
                  <CheckCircle2 className="h-5 w-5 text-[var(--v8-green)]" />
                ) : (
                  <Sparkles className="h-5 w-5 text-[var(--v8-accent)]" />
                )}
              </div>

              <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map((message) => (
                  <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <p
                      className={cn(
                        "max-w-[86%] rounded-[20px] px-4 py-2.5 text-[14px] leading-6 x-anim-rise",
                        message.role === "user"
                          ? "bg-[var(--v8-accent)] text-white"
                          : "bg-[var(--v8-panel-3)] text-[var(--v8-text)]"
                      )}
                    >
                      {message.text}
                    </p>
                  </div>
                ))}
                {sending ? (
                  <div className="flex items-center gap-1.5 px-1 text-[var(--v8-muted)]">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="h-2 w-2 rounded-full bg-current x-anim-blink"
                        style={{ animationDelay: `${dot * 160}ms` }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex-none border-t border-[var(--v8-line)] p-3">
                <div className="flex gap-2">
                  <label className="flux8-rail-search !static flex-1">
                    <Shield className="h-[18px] w-[18px] flex-none" />
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void send();
                      }}
                      placeholder="Describe what is broken"
                      aria-label="Support message"
                    />
                  </label>
                  <button
                    type="button"
                    className="x-btn h-11 w-11 flex-none !px-0"
                    onClick={() => void send()}
                    disabled={!input.trim() || sending}
                    aria-label="Send"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-[var(--v8-muted)]">
                  Say &ldquo;human support&rdquo; to send this context to the owner.
                </p>
              </div>
            </XCard>
          </div>
        ) : null}
      </XSwitch>
    </XPage>
  );
}

function supportAnswer(text: string): string {
  const lower = text.toLowerCase();
  if (/camera|microphone|mic|screen share|screen audio|live/.test(lower))
    return "Open Live Studio over HTTPS, choose Camera or Share Screen, allow browser permissions, then press Open Preview before Start Live. If mobile viewers cannot connect, Flux needs TURN credentials or an SFU.";
  if (/askai|ai|usage|limit|reset/.test(lower))
    return "Open AskAI and check the usage card. Search does not need a local model download; creator and assistant actions use the weekly limit. The owner can reset usage from Admin.";
  if (/studio|game|website|publish|marketplace/.test(lower))
    return "Open Flux Studio, generate or edit the project, test it in desktop/tablet/phone preview, save, then publish games to Flux Games. Verify the license on any marketplace reference before shipping.";
  if (/story|stories|viewer|views/.test(lower))
    return "Create Stories from the Story editor. Owners see unique viewers in the viewer list. If uploads fail, keep media under 40 MB and confirm Firebase Storage is configured.";
  if (/premium|basic|coins|verified|reward/.test(lower))
    return "Plans are bought with Flux Coins on the Premium page and rewards are claimed daily from Flux Rewards. Server-side validation is still required before high-value public use.";
  if (/ban|warning|report|harass|abuse|threat/.test(lower))
    return "Use the report action on the specific post, profile, group or message. For urgent account help say “human support” and I'll create a review item for the owner.";
  return "I couldn't match that to a known path. Tell me which page you are on, what you clicked, and the exact error. Say “human support” when the owner needs to review it.";
}
