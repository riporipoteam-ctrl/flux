"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  Loader2,
  MessageSquarePlus,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { runAskAIGroq, type AskAIGroqMode } from "@/lib/ai/askai-groq";
import { cn } from "@/lib/utils";

const AGENTS_KEY = "flux-maus-agents-v1";
const THREADS_KEY = "flux-maus-threads-v1";
const ACTIVE_KEY = "flux-maus-active-v1";

type MausAgent = {
  id: string;
  name: string;
  role: string;
  persona: string;
  emoji: string;
  mode: AskAIGroqMode;
  builtin?: boolean;
};

type MausMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

type ThreadMap = Record<string, MausMessage[]>;

const BUILTIN_AGENTS: MausAgent[] = [
  {
    id: "builder",
    name: "Builder",
    role: "Product engineer",
    persona: "You are Builder, a practical senior product engineer. Turn ideas into concrete implementation steps, identify edge cases, prefer simple maintainable architecture, and give code-oriented answers when useful.",
    emoji: "🛠️",
    mode: "pro",
    builtin: true,
  },
  {
    id: "scout",
    name: "Scout",
    role: "Research planner",
    persona: "You are Scout, a sharp research planner. Break vague questions into what must be verified, distinguish facts from assumptions, organize findings clearly, and never pretend you searched the web when tools are not available.",
    emoji: "🔎",
    mode: "instant",
    builtin: true,
  },
  {
    id: "creator",
    name: "Creator",
    role: "Creative director",
    persona: "You are Creator, an energetic creative director. Generate strong names, concepts, scripts, hooks, UI ideas and content directions while avoiding generic AI-sounding filler.",
    emoji: "✨",
    mode: "instant",
    builtin: true,
  },
  {
    id: "analyst",
    name: "Analyst",
    role: "Systems analyst",
    persona: "You are Analyst, a careful systems analyst. Compare tradeoffs, inspect requirements, find contradictions, quantify when possible, and produce concise recommendations with reasons.",
    emoji: "📊",
    mode: "pro",
    builtin: true,
  },
];

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export default function MausAgentsWorkspace() {
  const [agents, setAgents] = useState<MausAgent[]>(BUILTIN_AGENTS);
  const [activeId, setActiveId] = useState("builder");
  const [threads, setThreads] = useState<ThreadMap>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [mobileRoster, setMobileRoster] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newPersona, setNewPersona] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const custom = loadJson<MausAgent[]>(AGENTS_KEY, []);
    setAgents([...BUILTIN_AGENTS, ...custom.filter((agent) => !BUILTIN_AGENTS.some((item) => item.id === agent.id))]);
    setThreads(loadJson<ThreadMap>(THREADS_KEY, {}));
    const storedActive = localStorage.getItem(ACTIVE_KEY);
    if (storedActive) setActiveId(storedActive);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [loading, threads, activeId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const activeAgent = useMemo(() => agents.find((agent) => agent.id === activeId) || agents[0] || BUILTIN_AGENTS[0], [agents, activeId]);
  const messages = threads[activeAgent.id] || [];

  const selectAgent = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    setMobileRoster(false);
  };

  const persistThreads = (next: ThreadMap) => {
    setThreads(next);
    saveJson(THREADS_KEY, next);
  };

  const clearThread = () => {
    const next = { ...threads, [activeAgent.id]: [] };
    persistThreads(next);
    setInput("");
  };

  const addCustomAgent = () => {
    const name = newName.trim();
    const role = newRole.trim();
    const persona = newPersona.trim();
    if (!name || !role || !persona) {
      toast.error("Give the agent a name, role and instructions.");
      return;
    }
    const id = `custom-${Date.now().toString(36)}`;
    const agent: MausAgent = { id, name: name.slice(0, 36), role: role.slice(0, 70), persona: persona.slice(0, 1200), emoji: "🤖", mode: "instant" };
    const next = [...agents, agent];
    setAgents(next);
    saveJson(AGENTS_KEY, next.filter((item) => !item.builtin));
    selectAgent(id);
    setShowCreate(false);
    setNewName("");
    setNewRole("");
    setNewPersona("");
  };

  const deleteAgent = (agent: MausAgent) => {
    if (agent.builtin) return;
    const nextAgents = agents.filter((item) => item.id !== agent.id);
    setAgents(nextAgents);
    saveJson(AGENTS_KEY, nextAgents.filter((item) => !item.builtin));
    const nextThreads = { ...threads };
    delete nextThreads[agent.id];
    persistThreads(nextThreads);
    if (activeId === agent.id) selectAgent(BUILTIN_AGENTS[0].id);
  };

  const changeMode = (mode: AskAIGroqMode) => {
    const nextAgents = agents.map((agent) => agent.id === activeAgent.id ? { ...agent, mode } : agent);
    setAgents(nextAgents);
    saveJson(AGENTS_KEY, nextAgents.filter((item) => !item.builtin));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMessage: MausMessage = { id: `u-${Date.now()}`, role: "user", content: text, createdAt: Date.now() };
    const current = [...messages, userMessage];
    persistThreads({ ...threads, [activeAgent.id]: current });
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await runAskAIGroq({
        mode: activeAgent.mode,
        signal: controller.signal,
        workspaceContext: [
          `You are operating as a named Flux Maus Agent.`,
          `Agent name: ${activeAgent.name}`,
          `Agent role: ${activeAgent.role}`,
          `Agent instructions: ${activeAgent.persona}`,
          `This is the browser/web adaptation of OpenMausBot inside Flux AskAI.`,
          `Do not claim you executed desktop apps, shell commands, files, browser automation, connected apps, or computer-control actions unless the current Flux backend explicitly provides and returns such a tool result.`,
          `Stay in character while remaining accurate about capabilities.`,
        ].join("\n"),
        messages: current.slice(-24).map((message) => ({ role: message.role, content: message.content })),
      });
      const assistantMessage: MausMessage = { id: `a-${Date.now()}`, role: "assistant", content: result.answer, createdAt: Date.now() };
      const next = [...current, assistantMessage];
      persistThreads({ ...threads, [activeAgent.id]: next });
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      toast.error(error instanceof Error ? error.message : "Maus Agent could not answer.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  return (
    <main className="mausx-shell">
      <aside className={cn("mausx-roster", mobileRoster && "is-open")}>
        <header className="mausx-roster-head">
          <Link href="/ask-ai" aria-label="Back to AskAI"><ArrowLeft className="h-5 w-5" /></Link>
          <div><strong>Maus Agents</strong><span>Flux web edition</span></div>
          <button type="button" onClick={() => setMobileRoster(false)} className="mausx-mobile-close" aria-label="Close agents"><X className="h-5 w-5" /></button>
        </header>
        <button type="button" className="mausx-create-button" onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create agent</button>
        <div className="mausx-agent-list no-scrollbar">
          {agents.map((agent) => (
            <div key={agent.id} className={cn("mausx-agent-row", agent.id === activeAgent.id && "is-active")}> 
              <button type="button" onClick={() => selectAgent(agent.id)} className="mausx-agent-main">
                <span className="mausx-agent-avatar">{agent.emoji}</span>
                <span className="min-w-0"><strong>{agent.name}</strong><small>{agent.role}</small></span>
              </button>
              {!agent.builtin ? <button type="button" className="mausx-agent-delete" onClick={() => deleteAgent(agent)} aria-label={`Delete ${agent.name}`}><Trash2 className="h-3.5 w-3.5" /></button> : null}
            </div>
          ))}
        </div>
        <footer className="mausx-credit">
          <Bot className="h-4 w-4" />
          <p>Web adaptation inspired by <strong>OpenMausBot</strong> by Milind Soni and contributors · MIT.</p>
        </footer>
      </aside>

      {mobileRoster ? <button type="button" className="mausx-overlay" onClick={() => setMobileRoster(false)} aria-label="Close agent roster" /> : null}

      <section className="mausx-chat">
        <header className="mausx-chat-head">
          <button type="button" className="mausx-roster-toggle" onClick={() => setMobileRoster(true)} aria-label="Open agent roster"><Users className="h-5 w-5" /></button>
          <span className="mausx-agent-avatar is-large">{activeAgent.emoji}</span>
          <div className="min-w-0 flex-1"><strong>{activeAgent.name}</strong><span>{activeAgent.role} · Ripo Local</span></div>
          <div className="mausx-mode-switch">
            <button type="button" className={activeAgent.mode === "instant" ? "is-active" : ""} onClick={() => changeMode("instant")}><Zap className="h-3.5 w-3.5" /><span>Instant</span></button>
            <button type="button" className={activeAgent.mode === "pro" ? "is-active" : ""} onClick={() => changeMode("pro")}><Sparkles className="h-3.5 w-3.5" /><span>Pro</span></button>
          </div>
          <button type="button" className="mausx-clear" onClick={clearThread} title="New conversation"><MessageSquarePlus className="h-4 w-4" /></button>
        </header>

        <div className="mausx-capability-note"><Check className="h-4 w-4" /><span>Web agent mode is live. Chat/personality works through the Ripo AI server; desktop-only computer control and local CLI execution are intentionally not faked in the browser.</span></div>

        <div className="mausx-scroll no-scrollbar">
          {!messages.length ? (
            <div className="mausx-empty">
              <span className="mausx-empty-avatar">{activeAgent.emoji}</span>
              <p className="mausx-kicker">{activeAgent.role}</p>
              <h1>Talk to {activeAgent.name}</h1>
              <p>{activeAgent.persona}</p>
              <div className="mausx-prompts">
                {["Help me build something", "Review my idea and find problems", "Give me a concrete plan", "Explain this simply"].map((prompt) => <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}<ChevronDown className="h-3.5 w-3.5 -rotate-90" /></button>)}
              </div>
            </div>
          ) : (
            <div className="mausx-messages">
              {messages.map((message) => (
                <article key={message.id} className={cn("mausx-message", message.role === "user" ? "is-user" : "is-agent")}> 
                  {message.role === "assistant" ? <span className="mausx-message-avatar">{activeAgent.emoji}</span> : null}
                  <div><div className="mausx-message-name">{message.role === "user" ? "You" : activeAgent.name}</div><div className="mausx-message-body"><ReactMarkdown>{message.content}</ReactMarkdown></div></div>
                </article>
              ))}
              {loading ? <div className="mausx-thinking"><span className="mausx-message-avatar">{activeAgent.emoji}</span><Loader2 className="h-4 w-4 animate-spin" /><span>{activeAgent.name} is thinking…</span></div> : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="mausx-composer-wrap">
          <form className="mausx-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder={`Message ${activeAgent.name}…`} rows={1} />
            <button type="submit" disabled={!input.trim() || loading} className="mausx-send" aria-label="Send"><Send className="h-4 w-4" /></button>
          </form>
          <p>Agents use Flux&apos;s authenticated self-hosted AI endpoint. Conversations are stored in this browser for this web edition.</p>
        </footer>
      </section>

      {showCreate ? (
        <div className="mausx-modal-backdrop" role="presentation" onMouseDown={() => setShowCreate(false)}>
          <section className="mausx-modal" role="dialog" aria-modal="true" aria-label="Create Maus Agent" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><p className="mausx-kicker">Custom contact</p><h2>Create an AI agent</h2></div><button type="button" onClick={() => setShowCreate(false)}><X className="h-5 w-5" /></button></header>
            <label>Name<input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Game Designer" maxLength={36} /></label>
            <label>Role<input value={newRole} onChange={(event) => setNewRole(event.target.value)} placeholder="What is this agent best at?" maxLength={70} /></label>
            <label>Instructions<textarea value={newPersona} onChange={(event) => setNewPersona(event.target.value)} placeholder="Describe its personality, goals and how it should answer…" rows={6} maxLength={1200} /></label>
            <button type="button" className="mausx-modal-create" onClick={addCustomAgent}>Create agent <Plus className="h-4 w-4" /></button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
