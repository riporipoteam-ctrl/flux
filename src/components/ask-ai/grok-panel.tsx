"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Bot, Check, Copy, ExternalLink, Loader2, Plus, Send, Settings2, Sparkles, Trash2, Wifi, WifiOff } from "lucide-react";

type Role = "user" | "assistant";
type ChatMessage = { id: string; role: Role; content: string; createdAt: number };

type GrokConfig = { baseUrl: string; apiKey: string; model: string };
type GrokResponse = {
  error?: { message?: unknown } | string;
  detail?: unknown;
  choices?: Array<{ message?: { content?: unknown } }>;
  output_text?: unknown;
};

const DEFAULT_URL = process.env.NEXT_PUBLIC_GROK_BRIDGE_URL || "";
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_GROK_MODEL || "grok-4.20-auto";
const STORAGE_KEY = "flux-grok-session-v1";
const HISTORY_KEY = "flux-grok-history-v1";

const starterPrompts = [
  "What is happening in the tech world today?",
  "Help me design a better Roblox game loop.",
  "Write a clean React component for a social feed.",
  "Give me three ideas to grow Flux.",
];

function loadConfig(): GrokConfig {
  if (typeof window === "undefined") return { baseUrl: DEFAULT_URL, apiKey: "", model: DEFAULT_MODEL };
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null") as Partial<GrokConfig> | null;
    return {
      baseUrl: String(parsed?.baseUrl || DEFAULT_URL).trim(),
      apiKey: String(parsed?.apiKey || "").trim(),
      model: String(parsed?.model || DEFAULT_MODEL).trim(),
    };
  } catch {
    return { baseUrl: DEFAULT_URL, apiKey: "", model: DEFAULT_MODEL };
  }
}

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item): item is ChatMessage => Boolean(item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string" && typeof item.createdAt === "number")).slice(-80)
      : [];
  } catch {
    return [];
  }
}

function saveConfig(config: GrokConfig) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* privacy storage can be unavailable */ }
}

function saveHistory(messages: ChatMessage[]) {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-80))); } catch { /* private browsing */ }
}

function endpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/v1") ? `${trimmed}/grok/chat/completions` : `${trimmed}/v1/grok/chat/completions`;
}

function healthEndpoint(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed ? `${trimmed}/health` : "";
}

function messageId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

export default function GrokPanel() {
  const [config, setConfig] = useState<GrokConfig>({ baseUrl: DEFAULT_URL, apiKey: "", model: DEFAULT_MODEL });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
    setMessages(loadHistory());
  }, []);

  useEffect(() => { saveHistory(messages); }, [messages]);

  const configured = Boolean(config.baseUrl.trim() && config.apiKey.trim());
  const url = useMemo(() => endpoint(config.baseUrl), [config.baseUrl]);

  async function ping() {
    if (!config.baseUrl.trim()) { setOnline(false); return; }
    try {
      const response = await fetch(healthEndpoint(config.baseUrl), { headers: config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : undefined });
      setOnline(response.ok);
    } catch { setOnline(false); }
  }

  useEffect(() => {
    if (!config.baseUrl) return;
    void ping();
    const timer = window.setInterval(() => void ping(), 45_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.baseUrl]);

  function persist(next: GrokConfig) {
    setConfig(next);
    saveConfig(next);
    setOnline(null);
  }

  function clearChat() { setMessages([]); setDraft(""); }
  function newChat() { clearChat(); setShowSettings(false); }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1200);
    } catch { /* clipboard unavailable */ }
  }

  async function send(prompt?: string) {
    const content = (prompt ?? draft).trim();
    if (!content || busy || !url || !config.apiKey.trim()) return;

    const userMessage: ChatMessage = { id: messageId(), role: "user", content, createdAt: Date.now() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setBusy(true);
    setOnline(true);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey.trim()}` },
        body: JSON.stringify({
          model: config.model || DEFAULT_MODEL,
          stream: false,
          messages: nextMessages.map(({ role, content: text }) => ({ role, content: text })),
        }),
      });
      const raw = await response.text();
      let data: GrokResponse = {};
      try { data = JSON.parse(raw) as GrokResponse; } catch { /* normalize below */ }
      if (!response.ok) {
        const detail = String(
          typeof data.error === "object" ? data.error?.message : data.error || data.detail || `Grok bridge returned ${response.status}.`
        ).slice(0, 420);
        throw new Error(detail);
      }
      const answer = String(data.choices?.[0]?.message?.content || data.output_text || "").trim();
      if (!answer) throw new Error("Grok returned an empty answer.");
      setMessages((current) => [...current, { id: messageId(), role: "assistant", content: answer, createdAt: Date.now() }]);
    } catch (error) {
      setOnline(false);
      setMessages((current) => [...current, {
        id: messageId(),
        role: "assistant",
        content: `I couldn\'t reach the Grok bridge. ${error instanceof Error ? error.message : "Check the endpoint and API key in Grok settings."}`,
        createdAt: Date.now(),
      }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(); }

  return (
    <section className="askai-v11-grok" aria-label="Grok workspace">
      <header className="askai-v11-grok-header">
        <div className="askai-v11-grok-title">
          <span className="askai-v11-grok-mark"><Bot className="h-5 w-5" /></span>
          <div>
            <div className="flex items-center gap-2">
              <h2>Grok</h2>
              <span className="askai-v11-chip">Community bridge</span>
            </div>
            <p>{online === true ? "Connected" : online === false ? "Offline" : "Checking connection"} · {config.model || DEFAULT_MODEL}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`askai-v11-status ${online === true ? "is-online" : online === false ? "is-offline" : ""}`}>
            {online === true ? <Wifi className="h-3.5 w-3.5" /> : online === false ? <WifiOff className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{online === true ? "Live" : online === false ? "Offline" : "Checking"}</span>
          </span>
          <button type="button" className="askai-v11-icon-button" aria-label="New Grok chat" onClick={newChat}><Plus className="h-4 w-4" /></button>
          <button type="button" className="askai-v11-icon-button" aria-label="Grok settings" onClick={() => setShowSettings((value) => !value)}><Settings2 className="h-4 w-4" /></button>
          <button type="button" className="askai-v11-icon-button" aria-label="Clear chat" onClick={clearChat}><Trash2 className="h-4 w-4" /></button>
        </div>
      </header>

      {showSettings ? (
        <div className="askai-v11-settings">
          <div className="askai-v11-settings-head">
            <div><strong>Grok connection</strong><span>Credentials stay in this browser session only.</span></div>
            <button type="button" className="askai-v11-text-button" onClick={() => void ping()}>Test</button>
          </div>
          <label>Bridge URL<input value={config.baseUrl} onChange={(event) => persist({ ...config, baseUrl: event.target.value })} placeholder="https://your-bridge.example" /></label>
          <label>API key<input type="password" value={config.apiKey} onChange={(event) => persist({ ...config, apiKey: event.target.value })} placeholder="Bearer key from the bridge" autoComplete="off" /></label>
          <label>Model<input value={config.model} onChange={(event) => persist({ ...config, model: event.target.value })} placeholder="grok-4.20-auto" /></label>
          <div className="askai-v11-settings-note">
            <Sparkles className="h-4 w-4" />
            <span>Flux uses the community bridge's OpenAI-compatible Grok endpoint. It does not send your cookie or session token to the browser.</span>
            <a href="https://github.com/2noScript/unofficial-api" target="_blank" rel="noreferrer" aria-label="Open the community Grok bridge on GitHub"><ExternalLink className="h-4 w-4" /></a>
          </div>
        </div>
      ) : null}

      <div className="askai-v11-grok-scroll">
        {!messages.length ? (
          <div className="askai-v11-grok-empty">
            <div className="askai-v11-grok-orb"><Bot className="h-8 w-8" /></div>
            <h3>Talk to Grok inside Flux</h3>
            <p>Use a community OpenAI-compatible Grok bridge, keep the key in this session, and jump straight into a conversation.</p>
            <div className="askai-v11-prompt-grid">
              {starterPrompts.map((item) => (
                <button key={item} type="button" onClick={() => void send(item)} disabled={!configured || busy} className="askai-v11-prompt-card"><Sparkles className="h-4 w-4" /><span>{item}</span></button>
              ))}
            </div>
            {!configured ? <button type="button" onClick={() => setShowSettings(true)} className="askai-v11-connect-button"><Settings2 className="h-4 w-4" />Configure Grok</button> : null}
          </div>
        ) : (
          <div className="askai-v11-message-list">
            {messages.map((message) => (
              <article key={message.id} className={`askai-v11-message ${message.role === "user" ? "is-user" : "is-assistant"}`}>
                <div className="askai-v11-message-meta"><span>{message.role === "user" ? "You" : "Grok"}</span>{message.role === "assistant" ? <button type="button" onClick={() => void copyMessage(message)} aria-label="Copy response" className="askai-v11-message-copy">{copiedId === message.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</button> : null}</div>
                <div className="askai-v11-message-body">{message.content}</div>
              </article>
            ))}
            {busy ? <article className="askai-v11-message is-assistant"><div className="askai-v11-message-meta">Grok</div><div className="askai-v11-typing"><span /><span /><span /></div></article> : null}
          </div>
        )}
      </div>

      <footer className="askai-v11-composer-wrap">
        <form onSubmit={submit} className="askai-v11-composer">
          <button type="button" className="askai-v11-composer-add" aria-label="Add quick prompt" onClick={() => setDraft((current) => `${current}${current ? " " : ""}@Flux `)}><Plus className="h-4 w-4" /></button>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={1} placeholder={configured ? "Message Grok…" : "Configure Grok to start chatting…"} disabled={!configured || busy} />
          <button type="submit" className="askai-v11-send" disabled={!draft.trim() || !configured || busy} aria-label="Send to Grok">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
        </form>
        <div className="askai-v11-composer-meta"><span>Enter to send · Shift+Enter for a new line</span><span>{messages.length} messages</span></div>
      </footer>
    </section>
  );
}
