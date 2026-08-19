"use client";

import {
  Activity,
  Archive,
  ArrowUp,
  Brain,
  ChevronDown,
  Clock3,
  Code2,
  Command,
  FileCode2,
  FileText,
  FolderOpen,
  History,
  Laptop,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Pin,
  Play,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Terminal,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useAuth } from "@/contexts/auth-context";
import { runLocalAskAI } from "@/lib/local-ask-ai";
import { localAskAISupported, streamLocalAskAI } from "@/lib/ai/local-web-llm";
import {
  buildAskAIWorkspaceContext,
  deleteAskAIFile,
  deleteAskAIMemory,
  getAskAISettings,
  listAskAIAgents,
  listAskAIFiles,
  listAskAIJobs,
  listAskAIMemory,
  runAskAIJob,
  saveAskAIFile,
  saveAskAIJob,
  saveAskAIMemory,
  saveAskAISettings,
  type AskAIWorkspaceAgent,
  type AskAIWorkspaceFile,
  type AskAIWorkspaceJob,
  type AskAIWorkspaceSettings,
  type AskAIMemory,
} from "@/lib/askai-workspace";
import {
  addMessage,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  type AIConversation,
  type AIMessage,
} from "@/services/ai-chat";

type LocalConversation = AIConversation & { createdAt: number; updatedAt: null };
type RightPanel = "computer" | "routines" | "files" | "memory" | "settings";
const GUEST_OWNER_ID = "guest";

const STARTERS = [
  { label: "Explore this workspace", prompt: "Give me a practical overview of what Flux can do.", icon: Search },
  { label: "Review a project", prompt: "Help me review a Flux project and find the highest-impact improvements.", icon: Code2 },
  { label: "Plan a launch", prompt: "Create a clear launch plan for a new Flux feature.", icon: Zap },
  { label: "Run a routine", prompt: "Help me create a routine for checking the health of my project.", icon: Play },
];

const BOT_COLORS = ["#7666ff", "#2e9bff", "#16b98b", "#ec6b9e", "#e7a72e", "#7a7dff"];

export default function RakazoAskAIWorkspace() {
  const { user, profile, signOut } = useAuth();
  const [agents, setAgents] = useState<AskAIWorkspaceAgent[]>([]);
  const [jobs, setJobs] = useState<AskAIWorkspaceJob[]>([]);
  const [files, setFiles] = useState<AskAIWorkspaceFile[]>([]);
  const [memories, setMemories] = useState<AskAIMemory[]>([]);
  const [settings, setSettings] = useState<AskAIWorkspaceSettings>(() => getAskAISettings());
  const [selectedAgentId, setSelectedAgentId] = useState("askai");
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [runtimeNote, setRuntimeNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("computer");
  const [accountOpen, setAccountOpen] = useState(false);
  const [computerOpen, setComputerOpen] = useState(false);
  const [routineTitle, setRoutineTitle] = useState("");
  const [routinePrompt, setRoutinePrompt] = useState("");
  const [routineSchedule, setRoutineSchedule] = useState("Manual");
  const [memoryDraft, setMemoryDraft] = useState("");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [fileBusy, setFileBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) ?? agents[0];
  const selectedFiles = files.filter((file) => selectedFileIds.includes(file.id));
  const filteredAgents = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return agents;
    return agents.filter((agent) => `${agent.name} ${agent.description}`.toLowerCase().includes(value));
  }, [agents, query]);
  const displayName = profile?.displayName || user?.displayName || "Guest";
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "FX";

  const refreshWorkspace = useCallback(() => {
    setAgents(listAskAIAgents());
    setJobs(listAskAIJobs());
    setFiles(listAskAIFiles());
    setMemories(listAskAIMemory());
    setSettings(getAskAISettings());
  }, []);

  const refreshConversations = useCallback(async () => {
    const ownerId = user?.uid || GUEST_OWNER_ID;
    const remote = user ? await listConversations(user.uid).catch(() => []) : [];
    const local = readLocalConversations(ownerId);
    const merged = [...remote, ...local.filter((item) => !remote.some((remoteItem) => remoteItem.id === item.id))];
    setConversations(merged.sort((a, b) => conversationTime(b) - conversationTime(a)).slice(0, 30));
  }, [user]);

  useEffect(() => {
    refreshWorkspace();
    const refresh = () => refreshWorkspace();
    window.addEventListener("flux-askai-workspace-updated", refresh);
    return () => window.removeEventListener("flux-askai-workspace-updated", refresh);
  }, [refreshWorkspace]);

  useEffect(() => {
    void refreshConversations();
  }, [refreshConversations]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    const ownerId = user?.uid || GUEST_OWNER_ID;
    if (activeConversationId.startsWith("local-")) {
      setMessages(readLocalMessages(ownerId, activeConversationId));
      return;
    }
    if (!user) {
      setMessages([]);
      return;
    }
    getMessages(activeConversationId)
      .then((items) => setMessages(items.length ? items : readLocalMessages(ownerId, activeConversationId)))
      .catch(() => setMessages(readLocalMessages(ownerId, activeConversationId)));
  }, [activeConversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streaming]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 50), 180)}px`;
  }, [input]);

  const newThread = useCallback(() => {
    abortRef.current?.abort();
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setStreaming("");
    setRuntimeNote(null);
    setError(null);
    setLeftOpen(false);
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setLeftOpen(false);
    setRightOpen(false);
  }, []);

  const appendMessage = useCallback(async (conversationId: string, role: "user" | "assistant", content: string, meta?: Record<string, unknown>) => {
    const ownerId = user?.uid || GUEST_OWNER_ID;
    const message: AIMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      meta,
      createdAt: null,
    };
    setMessages((current) => [...current, message]);
    saveLocalMessage(ownerId, conversationId, message);
    if (user && !conversationId.startsWith("local-")) {
      await addMessage(conversationId, { role, content, meta }).catch(() => undefined);
    }
  }, [user]);

  const ensureConversation = useCallback(async (title: string) => {
    if (activeConversationId) return activeConversationId;
    if (user) {
      try {
        const id = await createConversation(user.uid, title.slice(0, 80) || "New thread");
        setActiveConversationId(id);
        return id;
      } catch {
        // Fall through to a local thread if Firebase is unavailable.
      }
    }
    const id = `local-${user?.uid || GUEST_OWNER_ID}-${Date.now()}`;
    saveLocalConversation(user?.uid || GUEST_OWNER_ID, { id, userId: user?.uid || GUEST_OWNER_ID, title: title.slice(0, 80) || "New thread", createdAt: Date.now(), updatedAt: null });
    setActiveConversationId(id);
    return id;
  }, [activeConversationId, user]);

  const sendMessage = useCallback(async (rawText: string) => {
    const text = rawText.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setRuntimeNote("Flux local runtime is preparing a response…");
    setInput("");
    const conversationId = await ensureConversation(text);
    const ownerId = user?.uid || GUEST_OWNER_ID;
    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: null,
    };
    setMessages((current) => [...current, userMessage]);
    saveLocalMessage(ownerId, conversationId, userMessage);
    if (user && !conversationId.startsWith("local-")) await addMessage(conversationId, { role: "user", content: text }).catch(() => undefined);

    const controller = new AbortController();
    abortRef.current = controller;
    const history = [...messages, userMessage].slice(-12).map((message) => ({ role: message.role, content: message.content }));
    let answer = "";
    try {
      if (localAskAISupported()) {
        setStreaming("");
        try {
          answer = await streamLocalAskAI({
            messages: history,
            systemPrompt: `You are ${selectedAgent?.name || "AskAI"}, a Flux workspace agent. ${selectedAgent?.instructions || "Be useful, accurate and direct."}\n\n${buildAskAIWorkspaceContext(selectedAgent || listAskAIAgents()[0], selectedFiles)}`,
            signal: controller.signal,
            onProgress: (label) => setRuntimeNote(label),
            onToken: (token) => setStreaming((current) => current + token),
          });
        } catch (localError) {
          if ((localError as DOMException)?.name === "AbortError") throw localError;
          answer = "";
        }
        setStreaming("");
      }
      if (!answer) {
        setRuntimeNote("Flux instant tools completed the response.");
        answer = runLocalAskAI(text).answer;
      }
      await appendMessage(conversationId, "assistant", answer, { engine: "flux-local", agentId: selectedAgent?.id || "askai" });
      await refreshConversations();
    } catch (sendError) {
      if ((sendError as DOMException)?.name !== "AbortError") setError(sendError instanceof Error ? sendError.message : "The response could not be completed.");
    } finally {
      abortRef.current = null;
      setBusy(false);
      setStreaming("");
      window.setTimeout(() => setRuntimeNote(null), 1600);
    }
  }, [appendMessage, busy, ensureConversation, messages, refreshConversations, selectedAgent, selectedFiles, user]);

  const stopResponse = useCallback(() => {
    abortRef.current?.abort();
    setBusy(false);
    setStreaming("");
    setRuntimeNote("Response stopped.");
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setFileBusy(true);
    try {
      const textLike = file.type.startsWith("text/") || /\.(txt|md|json|csv|html|css|js|ts|tsx|jsx)$/i.test(file.name);
      const text = textLike ? (await file.text()).slice(0, 200_000) : "";
      const dataUrl = file.type.startsWith("image/") ? await readAsDataUrl(file) : null;
      const saved = saveAskAIFile({ id: `file-${Date.now()}`, name: file.name, type: file.type || "file", size: file.size, text, dataUrl, createdAt: Date.now() });
      setFiles(listAskAIFiles());
      setSelectedFileIds((current) => [...current, saved.id]);
      setRuntimeNote(`${file.name} added to workspace context.`);
    } catch {
      setError("This file could not be added.");
    } finally {
      setFileBusy(false);
    }
  };

  const saveRoutine = () => {
    if (!routineTitle.trim() || !routinePrompt.trim()) return;
    saveAskAIJob({ title: routineTitle, prompt: routinePrompt, schedule: routineSchedule, enabled: true });
    setJobs(listAskAIJobs());
    setRoutineTitle("");
    setRoutinePrompt("");
    setRoutineSchedule("Manual");
    setRuntimeNote("Routine saved to this workspace.");
  };

  const saveMemory = () => {
    if (!memoryDraft.trim()) return;
    saveAskAIMemory(memoryDraft);
    setMemories(listAskAIMemory());
    setMemoryDraft("");
    setRuntimeNote("Memory saved to this workspace.");
  };

  const deleteThread = async (conversation: AIConversation) => {
    const ownerId = user?.uid || GUEST_OWNER_ID;
    if (conversation.id.startsWith("local-")) deleteLocalConversation(ownerId, conversation.id);
    else if (user) await deleteConversation(conversation.id).catch(() => undefined);
    if (activeConversationId === conversation.id) newThread();
    await refreshConversations();
  };

  const toggleRight = (panel: RightPanel) => {
    setRightPanel(panel);
    setRightOpen(true);
  };

  return (
    <div className="rakazo-shell" data-testid="rakazo-askai-workspace">
      {leftOpen || rightOpen ? <button type="button" className="rakazo-drawer-backdrop" onClick={() => { setLeftOpen(false); setRightOpen(false); }} aria-label="Close panels" /> : null}

      <aside className={`rakazo-sidebar ${leftOpen ? "is-open" : ""}`}>
        <div className="rakazo-sidebar-top">
          <div className="rakazo-brand"><BotMark color="#f1f1ef" size={40} /><span>Flux</span></div>
          <button type="button" className="rakazo-icon-button" onClick={newThread} aria-label="New thread" title="New thread"><Plus size={19} /></button>
        </div>
        <button type="button" className="rakazo-new-thread" onClick={newThread}><Plus size={16} /> New thread</button>
        <label className="rakazo-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search bots…" /><kbd><Command size={11} />K</kbd></label>

        <div className="rakazo-sidebar-scroll">
          <div className="rakazo-section-label">Bots</div>
          <div className="rakazo-bot-list">
            {filteredAgents.map((agent, index) => (
              <button key={agent.id} type="button" className={`rakazo-bot-row ${selectedAgent?.id === agent.id ? "is-selected" : ""}`} onClick={() => { setSelectedAgentId(agent.id); setLeftOpen(false); }}>
                <BotMark color={agent.color || BOT_COLORS[index % BOT_COLORS.length]} size={38} />
                <span className="rakazo-bot-copy"><strong>{agent.name}</strong><small>{agent.description}</small></span>
                {agent.status === "working" ? <span className="rakazo-bot-dot is-working" /> : null}
              </button>
            ))}
          </div>

          <div className="rakazo-section-heading"><span>Threads</span><span className="rakazo-count">{conversations.length}</span></div>
          <div className="rakazo-thread-list">
            {conversations.length ? conversations.map((conversation) => (
              <div key={conversation.id} className={`rakazo-thread-row ${activeConversationId === conversation.id ? "is-active" : ""}`}>
                <button type="button" onClick={() => selectConversation(conversation.id)}><MessageSquareText size={15} /><span>{conversation.title || "New thread"}</span></button>
                <button type="button" className="rakazo-thread-delete" onClick={() => void deleteThread(conversation)} aria-label={`Delete ${conversation.title}`}><MoreHorizontal size={15} /></button>
              </div>
            )) : <p className="rakazo-empty-copy">Your threads will appear here.</p>}
          </div>
        </div>

        <div className="rakazo-plugins">
          <span className="rakazo-section-label">Plugins</span>
          <div className="rakazo-plugin-icons"><button type="button" title="Code" onClick={() => setInput("Help me review code in this workspace.")}><Code2 size={15} /></button><button type="button" title="Files" onClick={() => toggleRight("files")}><FolderOpen size={15} /></button><button type="button" title="Memory" onClick={() => toggleRight("memory")}><Brain size={15} /></button><button type="button" title="Team Computer" onClick={() => toggleRight("computer")}><Laptop size={15} /></button></div>
          <button type="button" className="rakazo-browse-plugins"><Plus size={14} /> Browse plugins</button>
        </div>

        <div className="rakazo-account-wrap">
          {accountOpen ? <div className="rakazo-account-menu"><button type="button" onClick={() => toggleRight("settings")}><Settings2 size={15} /> Workspace settings</button>{user ? <button type="button" onClick={() => void signOut()}><Archive size={15} /> Sign out</button> : <span className="rakazo-account-menu-note">Guest mode · local only</span>}</div> : null}
          <button type="button" className="rakazo-account" onClick={() => setAccountOpen((value) => !value)}><span className="rakazo-account-avatar">{initials}</span><span><strong>{displayName}</strong><small>{user?.email || "Guest workspace · local only"}</small></span><ChevronDown size={15} /></button>
        </div>
      </aside>

      <main className="rakazo-main">
        <header className="rakazo-main-header">
          <button type="button" className="rakazo-mobile-menu" onClick={() => setLeftOpen(true)} aria-label="Open bots"><Menu size={20} /></button>
          <button type="button" className="rakazo-agent-header" onClick={() => toggleRight("settings")}>
            {selectedAgent ? <BotMark color={selectedAgent.color || "#7666ff"} size={38} /> : null}
            <span><strong>{selectedAgent?.name || "AskAI"}</strong><small>{selectedAgent?.description || "Your Flux agent workspace."}</small></span><ChevronDown size={15} />
          </button>
          <div className="rakazo-header-actions"><button type="button" title="Pin thread"><Pin size={17} /></button><button type="button" title="Thread history"><History size={18} /></button><button type="button" className="rakazo-mobile-menu" onClick={() => setRightOpen(true)} aria-label="Open inspector"><Laptop size={18} /></button><button type="button" title="More"><MoreHorizontal size={18} /></button></div>
        </header>

        <div className="rakazo-thread-scroll">
          {messages.length === 0 && !streaming ? <EmptyState displayName={displayName} agent={selectedAgent} onPrompt={(prompt) => void sendMessage(prompt)} /> : <div className="rakazo-message-list">{messages.map((message) => <MessageBubble key={message.id} message={message} agent={selectedAgent} />)}{streaming ? <MessageBubble message={{ id: "streaming", role: "assistant", content: streaming, createdAt: null }} agent={selectedAgent} streaming /> : null}<div ref={bottomRef} /></div>}
          {error ? <div className="rakazo-error"><X size={15} />{error}</div> : null}
        </div>

        <form className="rakazo-composer-wrap" onSubmit={handleSubmit}>
          {selectedFiles.length ? <div className="rakazo-file-chips">{selectedFiles.map((file) => <button key={file.id} type="button" onClick={() => setSelectedFileIds((current) => current.filter((id) => id !== file.id))}><FileText size={13} />{file.name}<X size={12} /></button>)}</div> : null}
          <div className="rakazo-composer">
            <textarea ref={composerRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={`Ask ${selectedAgent?.name || "AskAI"} anything…`} rows={1} disabled={busy && !streaming} />
            <div className="rakazo-composer-footer"><div className="rakazo-composer-tools"><button type="button" onClick={() => fileInputRef.current?.click()} title="Attach file" disabled={fileBusy}><Paperclip size={17} /></button><button type="button" onClick={() => setInput((current) => `${current}${current ? " " : ""}/ `)} title="Commands"><span>/</span></button><input ref={fileInputRef} type="file" className="sr-only" onChange={(event) => void handleFile(event)} /><span className="rakazo-runtime-label">{runtimeNote || "Local workspace"}</span></div><div className="rakazo-composer-actions"><button type="button" title="Tools" onClick={() => toggleRight("settings")}><Settings2 size={16} /></button>{busy ? <button type="button" className="rakazo-send-button is-stop" onClick={stopResponse} title="Stop response"><span /></button> : <button type="submit" className="rakazo-send-button" disabled={!input.trim()} title="Send"><ArrowUp size={18} /></button>}</div></div>
          </div>
          <p className="rakazo-composer-hint"><Command size={11} />↵ to send · Shift+↵ for newline</p>
        </form>
      </main>

      <aside className={`rakazo-inspector ${rightOpen ? "is-open" : ""}`}>
        <div className="rakazo-inspector-header"><strong>{rightPanel === "computer" ? "Team Computer" : rightPanel === "routines" ? "Routines" : rightPanel === "files" ? "Files" : rightPanel === "memory" ? "Memory" : "Settings"}</strong><button type="button" onClick={() => setRightOpen(false)} className="rakazo-close-mobile" aria-label="Close inspector"><X size={18} /></button><button type="button" title="More"><MoreHorizontal size={18} /></button></div>
        {rightPanel === "computer" ? <ComputerPanel open={computerOpen} onOpen={() => setComputerOpen(true)} onClose={() => setComputerOpen(false)} onPanel={toggleRight} /> : null}
        {rightPanel === "routines" ? <RoutinesPanel jobs={jobs} title={routineTitle} prompt={routinePrompt} schedule={routineSchedule} setTitle={setRoutineTitle} setPrompt={setRoutinePrompt} setSchedule={setRoutineSchedule} onSave={saveRoutine} onRun={(id) => { runAskAIJob(id); setJobs(listAskAIJobs()); setRuntimeNote("Routine queued in this workspace."); }} /> : null}
        {rightPanel === "files" ? <FilesPanel files={files} selectedIds={selectedFileIds} onSelect={(id) => setSelectedFileIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])} onDelete={(id) => { deleteAskAIFile(id); setFiles(listAskAIFiles()); setSelectedFileIds((current) => current.filter((value) => value !== id)); }} onAdd={() => fileInputRef.current?.click()} /> : null}
        {rightPanel === "memory" ? <MemoryPanel memories={memories} draft={memoryDraft} setDraft={setMemoryDraft} onSave={saveMemory} onDelete={(id) => { deleteAskAIMemory(id); setMemories(listAskAIMemory()); }} /> : null}
        {rightPanel === "settings" ? <SettingsPanel settings={settings} setSettings={(patch) => { const next = saveAskAISettings({ ...settings, ...patch }); setSettings(next); }} localSupported={localAskAISupported()} /> : null}
      </aside>

      {computerOpen ? <div className="rakazo-computer-overlay" role="dialog" aria-modal="true"><div className="rakazo-computer-window"><header><div><span className="rakazo-status-dot" /> Team Computer <small>workspace preview</small></div><button type="button" onClick={() => setComputerOpen(false)} aria-label="Close computer"><X size={18} /></button></header><div className="rakazo-terminal"><div className="rakazo-terminal-bar"><i /><i /><i /><span>team-computer · ~/workspace</span></div><pre>{"flux@team-computer:~/workspace$ ls\napps    docs    packages    projects\nflux@team-computer:~/workspace$ ready"}</pre></div><footer><span><Activity size={14} /> Preview surface</span><button type="button" onClick={() => setComputerOpen(false)}>Close preview</button></footer></div></div> : null}
    </div>
  );
}

function EmptyState({ displayName, agent, onPrompt }: { displayName: string; agent?: AskAIWorkspaceAgent; onPrompt: (prompt: string) => void }) {
  return <div className="rakazo-empty-state"><BotMark color={agent?.color || "#7666ff"} size={62} /><h1>Hey {displayName.split(" ")[0]}, how can I help?</h1><p>{agent?.description || "Give your Flux agent real work to do."}</p><div className="rakazo-starter-grid">{STARTERS.map(({ label, prompt, icon: Icon }) => <button key={label} type="button" onClick={() => onPrompt(prompt)}><Icon size={16} /><span>{label}</span></button>)}</div></div>;
}

function MessageBubble({ message, agent, streaming = false }: { message: AIMessage; agent?: AskAIWorkspaceAgent; streaming?: boolean }) {
  const isUser = message.role === "user";
  return <article className={`rakazo-message-row ${isUser ? "is-user" : "is-agent"}`}><div className="rakazo-message-avatar">{isUser ? <span className="rakazo-user-mark">You</span> : <BotMark color={agent?.color || "#7666ff"} size={32} />}</div><div className="rakazo-message-content"><div className="rakazo-message-meta"><strong>{isUser ? "You" : agent?.name || "AskAI"}</strong>{streaming ? <span className="rakazo-typing"><i /><i /><i /></span> : null}</div><div className="rakazo-markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div></div></article>;
}

function ComputerPanel({ open, onOpen, onClose, onPanel }: { open: boolean; onOpen: () => void; onClose: () => void; onPanel: (panel: RightPanel) => void }) {
  return <div className="rakazo-panel-body"><button type="button" className="rakazo-computer-card" onClick={open ? onClose : onOpen}><div className="rakazo-computer-card-header"><span><span className="rakazo-status-dot" />team-computer</span><span>Workspace</span><ChevronDown size={15} /></div><div className="rakazo-mini-terminal"><div><i /><i /><i /></div><pre>flux@team-computer:~/workspace$</pre></div><div className="rakazo-computer-card-footer"><span><b className="rakazo-status-dot" />Online<small>Preview surface</small></span><span>Open {open ? "close" : "preview"} <ArrowUp size={14} /></span></div></button><div className="rakazo-panel-section"><div className="rakazo-panel-section-title"><span>Routines</span><button type="button" onClick={() => onPanel("routines")}><Plus size={14} /> New routine</button></div><p className="rakazo-panel-muted">Create repeatable work for any Flux agent.</p></div><ActionGrid onPanel={onPanel} /></div>;
}

function ActionGrid({ onPanel }: { onPanel: ((panel: RightPanel) => void) | undefined }) {
  return <div className="rakazo-action-grid"><button type="button" onClick={() => onPanel?.("files")}><FolderOpen size={20} /><span>Explore<br />files</span></button><button type="button" onClick={() => onPanel?.("memory")}><Search size={20} /><span>Search<br />context</span></button><button type="button"><Terminal size={20} /><span>Open<br />terminal</span></button><button type="button" onClick={() => onPanel?.("routines")}><Play size={20} /><span>Run<br />routine</span></button></div>;
}

function RoutinesPanel({ jobs, title, prompt, schedule, setTitle, setPrompt, setSchedule, onSave, onRun }: { jobs: AskAIWorkspaceJob[]; title: string; prompt: string; schedule: string; setTitle: (value: string) => void; setPrompt: (value: string) => void; setSchedule: (value: string) => void; onSave: () => void; onRun: (id: string) => void }) {
  return <div className="rakazo-panel-body"><div className="rakazo-routine-create"><span className="rakazo-panel-eyebrow">New routine</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Routine name" /><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="What should the agent do?" rows={3} /><select value={schedule} onChange={(event) => setSchedule(event.target.value)}><option>Manual</option><option>Every morning</option><option>Every day</option><option>Every Monday</option></select><button type="button" onClick={onSave} disabled={!title.trim() || !prompt.trim()}>Save routine</button></div><div className="rakazo-panel-section"><div className="rakazo-panel-section-title"><span>Saved routines</span><span className="rakazo-count">{jobs.length}</span></div>{jobs.length ? jobs.map((job) => <div className="rakazo-routine-row" key={job.id}><span className="rakazo-routine-icon"><Clock3 size={16} /></span><span><strong>{job.title}</strong><small>{job.prompt}</small></span><span className="rakazo-routine-actions"><button type="button" onClick={() => onRun(job.id)} title="Run routine"><Play size={14} /></button><span>{job.schedule}</span></span></div>) : <p className="rakazo-panel-muted">No routines yet. Add one above.</p>}</div></div>;
}

function FilesPanel({ files, selectedIds, onSelect, onDelete, onAdd }: { files: AskAIWorkspaceFile[]; selectedIds: string[]; onSelect: (id: string) => void; onDelete: (id: string) => void; onAdd: () => void }) {
  return <div className="rakazo-panel-body"><button type="button" className="rakazo-dropzone" onClick={onAdd}><Paperclip size={18} /><strong>Add workspace file</strong><small>Text, code or image context</small></button><div className="rakazo-file-list">{files.length ? files.map((file) => <div className={`rakazo-file-row ${selectedIds.includes(file.id) ? "is-selected" : ""}`} key={file.id}><button type="button" onClick={() => onSelect(file.id)}><FileCode2 size={17} /><span><strong>{file.name}</strong><small>{formatBytes(file.size)} · {file.type || "file"}</small></span></button><button type="button" onClick={() => onDelete(file.id)} aria-label={`Delete ${file.name}`}><Trash2 size={15} /></button></div>) : <p className="rakazo-panel-muted">No files in this workspace.</p>}</div></div>;
}

function MemoryPanel({ memories, draft, setDraft, onSave, onDelete }: { memories: AskAIMemory[]; draft: string; setDraft: (value: string) => void; onSave: () => void; onDelete: (id: string) => void }) {
  return <div className="rakazo-panel-body"><div className="rakazo-memory-create"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Save something this workspace should remember…" rows={3} /><button type="button" onClick={onSave} disabled={!draft.trim()}>Save memory</button></div><div className="rakazo-memory-list">{memories.length ? memories.map((memory) => <div className="rakazo-memory-row" key={memory.id}><Brain size={16} /><p>{memory.text}</p><button type="button" onClick={() => onDelete(memory.id)} aria-label="Delete memory"><Trash2 size={14} /></button></div>) : <p className="rakazo-panel-muted">No workspace memory saved yet.</p>}</div></div>;
}

function SettingsPanel({ settings, setSettings, localSupported }: { settings: AskAIWorkspaceSettings; setSettings: (patch: Partial<AskAIWorkspaceSettings>) => void; localSupported: boolean }) {
  return <div className="rakazo-panel-body"><div className="rakazo-settings-block"><span className="rakazo-panel-eyebrow">Flux runtime</span><div className="rakazo-runtime-card"><Zap size={17} /><span><strong>Instant local tools</strong><small>Always available in this workspace.</small></span><b>Ready</b></div><div className="rakazo-runtime-card"><Sparkles size={17} /><span><strong>Private browser model</strong><small>{localSupported ? "WebGPU is available on this device." : "WebGPU is unavailable in this browser."}</small></span><b>{localSupported ? "Ready" : "Optional"}</b></div></div><label className="rakazo-toggle"><span><strong>Confirm actions</strong><small>Ask before creating agents, routines or Flux artifacts.</small></span><input type="checkbox" checked={settings.confirmActions} onChange={(event) => setSettings({ confirmActions: event.target.checked })} /></label><label className="rakazo-toggle"><span><strong>Read replies aloud</strong><small>Use your device voice for completed replies.</small></span><input type="checkbox" checked={settings.speakReplies} onChange={(event) => setSettings({ speakReplies: event.target.checked })} /></label><p className="rakazo-panel-note">Guest workspaces stay on this device. Sign in is only needed when you want Flux workspace sync across devices.</p></div>;
}

function BotMark({ color, size }: { color: string; size: number }) {
  const visorWidth = Math.round(size * 0.68);
  const visorHeight = Math.round(size * 0.4);
  const dot = Math.max(3, Math.round(size * 0.1));
  return <span className="rakazo-bot-mark" style={{ width: size, height: size, background: color }} aria-hidden="true"><span style={{ width: visorWidth, height: visorHeight, gap: Math.max(4, Math.round(size * 0.13)) }}><i style={{ width: dot, height: dot }} /><i style={{ width: dot, height: dot }} /></span></span>;
}

function conversationTime(conversation: AIConversation): number {
  return conversation.updatedAt?.toMillis?.() || (typeof conversation.createdAt === "number" ? conversation.createdAt : 0);
}

function localConversationKey(uid: string) { return `flux-rakazo-local-conversations-${uid}`; }
function localMessagesKey(uid: string, conversationId: string) { return `flux-rakazo-local-messages-${uid}-${conversationId}`; }

function readLocalConversations(uid: string): LocalConversation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(localConversationKey(uid)) || "[]") as LocalConversation[]; } catch { return []; }
}

function saveLocalConversation(uid: string, conversation: LocalConversation): void {
  if (typeof window === "undefined") return;
  const current = readLocalConversations(uid).filter((item) => item.id !== conversation.id);
  localStorage.setItem(localConversationKey(uid), JSON.stringify([conversation, ...current].slice(0, 30)));
}

function readLocalMessages(uid: string, conversationId: string): AIMessage[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(localMessagesKey(uid, conversationId)) || "[]") as AIMessage[]; } catch { return []; }
}

function saveLocalMessage(uid: string, conversationId: string, message: AIMessage): void {
  if (typeof window === "undefined") return;
  const current = readLocalMessages(uid, conversationId);
  localStorage.setItem(localMessagesKey(uid, conversationId), JSON.stringify([...current, message].slice(-100)));
}

function deleteLocalConversation(uid: string, conversationId: string): void {
  if (typeof window === "undefined") return;
  const conversations = readLocalConversations(uid).filter((item) => item.id !== conversationId);
  localStorage.setItem(localConversationKey(uid), JSON.stringify(conversations));
  localStorage.removeItem(localMessagesKey(uid, conversationId));
}

async function readAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
