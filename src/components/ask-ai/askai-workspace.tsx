"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Archive,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Code2,
  Copy,
  FileText,
  FolderOpen,
  Globe2,
  Image as ImageIcon,
  LayoutDashboard,
  Loader2,
  MemoryStick,
  Menu,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  WandSparkles,
  Wifi,
  WifiOff,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth-context";
import {
  addMessage,
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation,
  type AIConversation,
  type AIMessage,
} from "@/services/ai-chat";
import { searchFlux, type FluxSearchResult } from "@/services/flux-search";
import { createGroup } from "@/services/groups";
import { consumeAskAIRequest, saveFluxAgent, usagePercent } from "@/services/flux-platform";
import { generateProject } from "@/lib/project-generator";
import { runLocalAskAI } from "@/lib/local-ask-ai";
import { localAskAISupported, streamLocalAskAI } from "@/lib/ai/local-web-llm";
import { saveLocalProject, type GeneratedProject } from "@/services/studio-projects";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import {
  buildAskAIWorkspaceContext,
  createAskAIMiniapp,
  deleteAskAIAgent,
  deleteAskAIFile,
  deleteAskAIJob,
  deleteAskAIMemory,
  deleteAskAIMiniapp,
  getAskAISettings,
  listAskAIAgents,
  listAskAIFiles,
  listAskAIJobs,
  listAskAIMemory,
  listAskAIMiniapps,
  runAskAIJob,
  saveAskAIAgent,
  saveAskAIFile,
  saveAskAIJob,
  saveAskAIMemory,
  saveAskAISettings,
  updateAskAIMiniapp,
  type AskAIWorkspaceAgent,
  type AskAIWorkspaceFile,
  type AskAIWorkspaceJob,
  type AskAIWorkspaceSettings,
  type AskAIWorkspaceView,
  type AskAIMemory,
  type AskAIMiniapp,
  type AskAIToolId,
} from "@/lib/askai-workspace";

interface ActivityItem {
  id: string;
  label: string;
  detail: string;
  status: "running" | "done" | "warning" | "error";
  createdAt: number;
}

interface PendingAction {
  id: string;
  title: string;
  description: string;
  execute: () => Promise<void>;
}

interface Artifact {
  id: string;
  type: "project" | "group" | "agent" | "job" | "miniapp" | "memory";
  title: string;
  description: string;
  href?: string;
}

interface SpeechRecognitionResultLike {
  readonly 0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const VIEWS: Array<{ id: AskAIWorkspaceView; label: string; icon: LucideIcon }> = [
  { id: "chat", label: "Home", icon: MessageSquareText },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "jobs", label: "Jobs", icon: Clock3 },
  { id: "miniapps", label: "Miniapps", icon: LayoutDashboard },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "memory", label: "Memory", icon: Brain },
];

const STARTERS = [
  { title: "Research", prompt: "Research the best ways to grow a new social network and give me a practical plan.", icon: Search },
  { title: "Create", prompt: "Build a polished mobile browser game about protecting a futuristic city.", icon: WandSparkles },
  { title: "Social", prompt: "Write five natural launch posts for Flux without corporate-sounding language.", icon: MessageSquareText },
  { title: "Miniapp", prompt: "Create a checklist miniapp for preparing a game release.", icon: LayoutDashboard },
];

const TOOL_LABELS: Record<AskAIToolId, string> = {
  web: "Web research",
  "flux-search": "Flux search",
  code: "Code",
  studio: "Studio",
  social: "Social actions",
  files: "Files",
  memory: "Memory",
};

export default function AskAIWorkspace() {
  const { user, profile, refreshProfile } = useAuth();
  const [view, setView] = useState<AskAIWorkspaceView>("chat");
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [results, setResults] = useState<FluxSearchResult[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [agents, setAgents] = useState<AskAIWorkspaceAgent[]>([]);
  const [jobs, setJobs] = useState<AskAIWorkspaceJob[]>([]);
  const [miniapps, setMiniapps] = useState<AskAIMiniapp[]>([]);
  const [memories, setMemories] = useState<AskAIMemory[]>([]);
  const [files, setFiles] = useState<AskAIWorkspaceFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("askai");
  const [settings, setSettings] = useState<AskAIWorkspaceSettings>({ confirmActions: true, speakReplies: false, engine: "auto" });
  const [agentDraft, setAgentDraft] = useState({ name: "", description: "", instructions: "", tools: ["files", "memory"] as AskAIToolId[] });
  const [jobDraft, setJobDraft] = useState({ title: "", prompt: "", schedule: "Manual" });
  const [miniappPrompt, setMiniappPrompt] = useState("");
  const [memoryDraft, setMemoryDraft] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const endpoint = useMemo(resolveEndpoint, []);
  const percent = usagePercent(profile);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId) || agents[0];
  const selectedFiles = files.filter((file) => selectedFileIds.includes(file.id));

  const refreshWorkspace = useCallback(() => {
    setAgents(listAskAIAgents());
    setJobs(listAskAIJobs());
    setMiniapps(listAskAIMiniapps());
    setMemories(listAskAIMemory());
    setFiles(listAskAIFiles());
    setSettings(getAskAISettings());
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!user) return;
    const local = readLocalConversations(user.uid);
    const remote = await listConversations(user.uid).catch(() => []);
    const merged = [...remote];
    for (const thread of local) if (!merged.some((item) => item.id === thread.id)) merged.push(thread);
    setConversations(merged.sort((a, b) => conversationTime(b) - conversationTime(a)));
  }, [user]);

  useEffect(() => {
    refreshWorkspace();
    const refresh = () => refreshWorkspace();
    window.addEventListener("flux-askai-workspace-updated", refresh);
    return () => window.removeEventListener("flux-askai-workspace-updated", refresh);
  }, [refreshWorkspace]);

  useEffect(() => { void refreshConversations(); }, [refreshConversations]);

  useEffect(() => {
    setResults([]);
    setArtifacts([]);
    setPendingAction(null);
    if (!activeId || !user) {
      setMessages([]);
      return;
    }
    if (activeId.startsWith("local-")) {
      setMessages(readLocalMessages(user.uid, activeId));
      return;
    }
    getMessages(activeId)
      .then((items) => setMessages(items.length ? items : readLocalMessages(user.uid, activeId)))
      .catch(() => setMessages(readLocalMessages(user.uid, activeId)));
  }, [activeId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activities, artifacts, loading, messages, results, streamingText]);

  useEffect(() => () => {
    abortRef.current?.abort();
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const addActivity = useCallback((label: string, detail: string, statusValue: ActivityItem["status"] = "running") => {
    const id = `activity-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setActivities((current) => [{ id, label, detail, status: statusValue, createdAt: Date.now() }, ...current].slice(0, 30));
    return id;
  }, []);

  const finishActivity = useCallback((id: string, statusValue: ActivityItem["status"], detail?: string) => {
    setActivities((current) => current.map((item) => item.id === id ? { ...item, status: statusValue, detail: detail || item.detail } : item));
  }, []);

  const ensureConversation = useCallback(async (title: string): Promise<string> => {
    if (activeId) return activeId;
    if (!user) throw new Error("Sign in to use AskAI.");
    try {
      const id = await createConversation(user.uid, title.slice(0, 60) || "New thread");
      setActiveId(id);
      return id;
    } catch {
      const id = `local-${Date.now()}`;
      saveLocalConversation(user.uid, { id, userId: user.uid, title: title.slice(0, 60) || "New thread", updatedAt: null, createdAt: Date.now() });
      setActiveId(id);
      return id;
    }
  }, [activeId, user]);

  const append = useCallback(async (conversationId: string, role: "user" | "assistant", content: string, meta?: Record<string, unknown>) => {
    if (!user) return;
    const item: AIMessage = {
      id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role,
      content,
      meta,
      createdAt: null,
    };
    setMessages((current) => [...current, item]);
    saveLocalMessage(user.uid, conversationId, item);
    if (!conversationId.startsWith("local-")) {
      await addMessage(conversationId, { role, content, meta }).catch(() => undefined);
    }
  }, [user]);

  const newThread = useCallback(async () => {
    if (!user) return;
    let id: string;
    try {
      id = await createConversation(user.uid, "New thread");
    } catch {
      id = `local-${Date.now()}`;
      saveLocalConversation(user.uid, { id, userId: user.uid, title: "New thread", updatedAt: null, createdAt: Date.now() });
    }
    setActiveId(id);
    setMessages([]);
    setInput("");
    setResults([]);
    setArtifacts([]);
    setPendingAction(null);
    setView("chat");
    setLeftOpen(false);
    await refreshConversations();
  }, [refreshConversations, user]);

  const removeConversation = useCallback(async (conversation: AIConversation) => {
    if (!user) return;
    if (conversation.id.startsWith("local-")) deleteLocalConversation(user.uid, conversation.id);
    else await deleteConversation(conversation.id).catch(() => deleteLocalConversation(user.uid, conversation.id));
    if (activeId === conversation.id) {
      setActiveId(null);
      setMessages([]);
    }
    await refreshConversations();
  }, [activeId, refreshConversations, user]);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(stripMarkdown(text).slice(0, 4000));
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const runModel = useCallback(async (conversationId: string, text: string) => {
    if (!user || !selectedAgent) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const context = buildAskAIWorkspaceContext(selectedAgent, selectedFiles);
    const history = [...messages, { id: "current", role: "user" as const, content: text, createdAt: null }];
    const enginePreference = settings.engine;

    const tryRemote = async (): Promise<string | null> => {
      if (!endpoint || enginePreference === "local" || enginePreference === "instant") return null;
      const activityId = addActivity("Connected model", "Sending the thread and workspace context to the configured AskAI endpoint.");
      setStatus("Connected model is working…");
      try {
        await consumeAskAIRequest(user.uid).catch(() => undefined);
        const answer = await askRemote({ endpoint, text, history, context, signal: controller.signal });
        finishActivity(activityId, "done", "Connected model completed the response.");
        await refreshProfile().catch(() => undefined);
        return answer;
      } catch (error) {
        if ((error as DOMException)?.name === "AbortError") throw error;
        finishActivity(activityId, "warning", error instanceof Error ? error.message : "Connected model failed.");
        if (enginePreference === "remote") throw error;
        return null;
      }
    };

    const remoteAnswer = await tryRemote();
    if (remoteAnswer) {
      await append(conversationId, "assistant", remoteAnswer, { engine: "remote", agentId: selectedAgent.id });
      if (settings.speakReplies) speak(remoteAnswer);
      return;
    }

    if (enginePreference !== "instant" && localAskAISupported()) {
      const activityId = addActivity("Local model", "Loading the private WebGPU model in this browser. The first run downloads model files.");
      setStatus("Preparing private local model…");
      setProgress(null);
      setStreamingText("");
      try {
        const answer = await streamLocalAskAI({
          messages: [
            { role: "user", content: `${context}\n\nAnswer the user's request below. Do not repeat the workspace context.\n\nUSER REQUEST: ${text}` },
            ...history.slice(-8).map((message) => ({ role: message.role, content: message.content })),
          ],
          signal: controller.signal,
          onProgress: (label, value) => {
            setStatus(label);
            setProgress(typeof value === "number" ? value : null);
          },
          onToken: (token) => setStreamingText((current) => current + token),
        });
        finishActivity(activityId, "done", "The response was generated privately on this device.");
        setStreamingText("");
        await append(conversationId, "assistant", answer, { engine: "local-webgpu", agentId: selectedAgent.id });
        if (settings.speakReplies) speak(answer);
        return;
      } catch (error) {
        setStreamingText("");
        if ((error as DOMException)?.name === "AbortError") throw error;
        finishActivity(activityId, "warning", error instanceof Error ? error.message : "Local model could not run.");
        if (enginePreference === "local") toast.message("The WebGPU model could not start, so AskAI used its instant local engine.");
      }
    }

    const activityId = addActivity("Instant local engine", "Answering immediately without a model download.");
    setStatus("Answering locally…");
    const local = runLocalAskAI(text);
    const answer = local.answer;
    finishActivity(activityId, "done", "Instant local response completed.");
    await append(conversationId, "assistant", answer, { engine: "instant-local", intent: local.intent, agentId: selectedAgent.id });
    if (settings.speakReplies) speak(answer);
  }, [addActivity, append, endpoint, finishActivity, messages, refreshProfile, selectedAgent, selectedFiles, settings.engine, settings.speakReplies, speak, user]);

  const performSearch = useCallback(async (conversationId: string, text: string) => {
    const query = text.replace(/^(search|find|look up)\s+(flux\s+)?/i, "").replace(/\s+(on|in)\s+flux$/i, "").trim();
    if (query.length < 2) throw new Error("Type at least two characters to search Flux.");
    const activityId = addActivity("Flux search", `Searching public Flux content for “${query}”.`);
    setStatus("Searching Flux…");
    const found = await searchFlux(query, { max: 36 });
    setResults(found);
    finishActivity(activityId, "done", `${found.length} result${found.length === 1 ? "" : "s"} found.`);
    await append(conversationId, "assistant", found.length
      ? `I found **${found.length}** public Flux result${found.length === 1 ? "" : "s"} for **${query}**. They are shown below.`
      : `I couldn't find public Flux content matching **${query}**.`);
  }, [addActivity, append, finishActivity]);

  const performProject = useCallback(async (conversationId: string, text: string, kind: "game" | "website") => {
    if (!user) return;
    const activityId = addActivity("Studio Builder", `Creating an editable ${kind} project.`);
    setStatus(`Creating ${kind} project…`);
    const project = generateProject({ ownerId: user.uid, kind, prompt: text });
    project.assistantHistory = [
      { id: `user-${Date.now()}`, role: "user", content: text, createdAt: Date.now() },
      { id: `assistant-${Date.now() + 1}`, role: "assistant", content: "Created from the AskAI workspace.", createdAt: Date.now() + 1 },
    ];
    saveLocalProject(project);
    finishActivity(activityId, "done", `${project.title} is ready in Studio.`);
    setArtifacts([{ id: project.id, type: "project", title: project.title, description: `Editable ${kind} project`, href: "/studio" }]);
    await append(conversationId, "assistant", `Created **${project.title}** as an editable Studio project. Open Studio to continue visually or in code.`);
  }, [addActivity, append, finishActivity, user]);

  const performGroup = useCallback(async (conversationId: string, text: string) => {
    if (!user) return;
    const name = extractNamedThing(text, "group") || "New Flux Group";
    const activityId = addActivity("Flux action", `Creating the group “${name}”.`);
    setStatus("Creating group…");
    const id = await createGroup({ ownerId: user.uid, name, description: `Created from AskAI: ${text.slice(0, 220)}`, isPrivate: false });
    finishActivity(activityId, "done", "Group created.");
    setArtifacts([{ id, type: "group", title: name, description: "Flux community", href: `/groups/${id}` }]);
    await append(conversationId, "assistant", `Created **${name}**. You can open it now to add members, posts and community details.`);
  }, [addActivity, append, finishActivity, user]);

  const performAgent = useCallback(async (conversationId: string, text: string) => {
    if (!user) return;
    const name = extractNamedThing(text, "agent") || "Custom Agent";
    const instructions = text.replace(/.*\bagent\b/i, "").trim() || "Help with this workspace.";
    const agent = saveAskAIAgent({
      name,
      description: instructions.slice(0, 150),
      instructions,
      tools: ["files", "memory", "flux-search"],
      color: "#6d5dfc",
      icon: "✦",
    });
    await saveFluxAgent(user.uid, { name: agent.name, instructions: agent.instructions }).catch(() => undefined);
    refreshWorkspace();
    setSelectedAgentId(agent.id);
    setArtifacts([{ id: agent.id, type: "agent", title: agent.name, description: agent.description }]);
    await append(conversationId, "assistant", `Created **${agent.name}** and selected it for this workspace.`);
  }, [append, refreshWorkspace, user]);

  const performJob = useCallback(async (conversationId: string, text: string) => {
    const schedule = extractSchedule(text);
    const title = extractNamedThing(text, "job") || titleFromText(text, "New job");
    const job = saveAskAIJob({ title, prompt: text, schedule, enabled: true });
    refreshWorkspace();
    setArtifacts([{ id: job.id, type: "job", title: job.title, description: `${job.schedule} · local schedule` }]);
    await append(conversationId, "assistant", `Created the job **${job.title}** with schedule **${job.schedule}**. Local jobs are stored safely and can be run from the Jobs panel. Always-on execution still needs a server worker.`);
  }, [append, refreshWorkspace]);

  const performMiniapp = useCallback(async (conversationId: string, text: string) => {
    const app = createAskAIMiniapp(text);
    refreshWorkspace();
    setArtifacts([{ id: app.id, type: "miniapp", title: app.title, description: `${app.type} miniapp` }]);
    await append(conversationId, "assistant", `Built **${app.title}** as an interactive ${app.type} miniapp. Open the Miniapps panel to use it.`);
  }, [append, refreshWorkspace]);

  const performMemory = useCallback(async (conversationId: string, text: string) => {
    const value = text.replace(/^(remember|save to memory|remember that)\s*/i, "").trim();
    if (!value) throw new Error("Tell me what you want AskAI to remember.");
    const memory = saveAskAIMemory(value);
    refreshWorkspace();
    setArtifacts([{ id: memory.id, type: "memory", title: "Saved memory", description: memory.text }]);
    await append(conversationId, "assistant", `Saved this to workspace memory: **${value}**`);
  }, [append, refreshWorkspace]);

  const runAction = useCallback(async (conversationId: string, intent: ReturnType<typeof detectIntent>, text: string) => {
    if (intent === "search") return performSearch(conversationId, text);
    if (intent === "game") return performProject(conversationId, text, "game");
    if (intent === "website") return performProject(conversationId, text, "website");
    if (intent === "group") return performGroup(conversationId, text);
    if (intent === "agent") return performAgent(conversationId, text);
    if (intent === "job") return performJob(conversationId, text);
    if (intent === "miniapp") return performMiniapp(conversationId, text);
    if (intent === "memory") return performMemory(conversationId, text);
    return runModel(conversationId, text);
  }, [performAgent, performGroup, performJob, performMemory, performMiniapp, performProject, performSearch, runModel]);

  const send = useCallback(async (override?: string) => {
    if (!user || loading) return;
    const text = (override ?? input).trim();
    if (!text) return;
    setInput("");
    setLoading(true);
    setStatus("Understanding the request…");
    setProgress(null);
    setResults([]);
    setArtifacts([]);
    setPendingAction(null);
    let conversationId: string | null = null;

    try {
      conversationId = await ensureConversation(text);
      await append(conversationId, "user", text, { agentId: selectedAgent?.id || "askai", files: selectedFileIds });
      if (messages.length === 0) {
        const title = titleFromText(text, "New thread");
        if (conversationId.startsWith("local-")) renameLocalConversation(user.uid, conversationId, title);
        else void renameConversation(conversationId, title).catch(() => renameLocalConversation(user.uid, conversationId!, title));
      }
      const intent = detectIntent(text);
      const risky = intent !== "answer" && intent !== "search" && intent !== "memory";
      if (risky && settings.confirmActions) {
        const actionId = `approval-${Date.now()}`;
        setPendingAction({
          id: actionId,
          title: approvalTitle(intent),
          description: text,
          execute: async () => {
            setPendingAction(null);
            setLoading(true);
            await runAction(conversationId!, intent, text);
          },
        });
        addActivity("Approval required", `${approvalTitle(intent)} is waiting for confirmation.`, "warning");
        await append(conversationId, "assistant", `I’m ready to **${approvalTitle(intent).toLowerCase()}**. Confirm the action below before I change anything.`);
      } else {
        await runAction(conversationId, intent, text);
      }
      await refreshConversations();
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "AskAI could not finish that request.";
      toast.error(message);
      if (conversationId) await append(conversationId, "assistant", `I couldn't finish that request: ${message}`);
    } finally {
      setLoading(false);
      setStatus(null);
      setProgress(null);
      abortRef.current = null;
    }
  }, [addActivity, append, ensureConversation, input, loading, messages.length, refreshConversations, runAction, selectedAgent?.id, selectedFileIds, settings.confirmActions, user]);

  const approvePending = async () => {
    const action = pendingAction;
    if (!action) return;
    try {
      await action.execute();
      await refreshConversations();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action failed.");
    } finally {
      setLoading(false);
      setStatus(null);
      setPendingAction(null);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setStreamingText("");
    setLoading(false);
    setStatus(null);
    setProgress(null);
  };

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const target = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = target.SpeechRecognition || target.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice input is not supported by this browser.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setInput((current) => `${current}${current ? " " : ""}${transcript}`);
    };
    recognition.onerror = () => toast.error("Voice input stopped unexpectedly.");
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []).slice(0, 6);
    if (!incoming.length) return;
    const activityId = addActivity("Files", `Reading ${incoming.length} attachment${incoming.length === 1 ? "" : "s"} locally.`);
    for (const file of incoming) {
      try {
        const text = await extractFileText(file);
        const dataUrl = file.type.startsWith("image/") && file.size <= 1_400_000 ? await readDataUrl(file) : null;
        const saved = saveAskAIFile({
          id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          type: file.type,
          size: file.size,
          text,
          dataUrl,
          createdAt: Date.now(),
        });
        setSelectedFileIds((current) => [...new Set([...current, saved.id])]);
      } catch (error) {
        toast.error(`${file.name}: ${error instanceof Error ? error.message : "could not read file"}`);
      }
    }
    refreshWorkspace();
    finishActivity(activityId, "done", "Attachments are available to the active agent.");
    event.target.value = "";
  };

  const updateSettings = (patch: Partial<AskAIWorkspaceSettings>) => {
    const next = saveAskAISettings({ ...settings, ...patch });
    setSettings(next);
  };

  const saveAgentDraft = () => {
    if (!agentDraft.name.trim()) return toast.error("Give the agent a name.");
    const agent = saveAskAIAgent({
      name: agentDraft.name,
      description: agentDraft.description,
      instructions: agentDraft.instructions || `Help with ${agentDraft.description || agentDraft.name}.`,
      tools: agentDraft.tools,
      color: "#6d5dfc",
      icon: "✦",
    });
    setAgentDraft({ name: "", description: "", instructions: "", tools: ["files", "memory"] });
    setSelectedAgentId(agent.id);
    refreshWorkspace();
    toast.success(`${agent.name} created`);
  };

  const saveJobDraft = () => {
    if (!jobDraft.title.trim() || !jobDraft.prompt.trim()) return toast.error("Add a job name and instruction.");
    saveAskAIJob({ ...jobDraft, enabled: true });
    setJobDraft({ title: "", prompt: "", schedule: "Manual" });
    refreshWorkspace();
    toast.success("Job saved");
  };

  const saveMemoryDraft = () => {
    if (!memoryDraft.trim()) return;
    saveAskAIMemory(memoryDraft);
    setMemoryDraft("");
    refreshWorkspace();
  };

  const hasThread = messages.length > 0 || streamingText || loading;

  return (
    <main className="askai-shell">
      <aside className={cn("askai-sidebar", leftOpen && "is-open")}>
        <div className="askai-workspace-switcher">
          <div className="askai-workspace-mark">F</div>
          <div><strong>Flux Workspace</strong><span>{profile?.displayName || "Personal workspace"}</span></div>
          <ChevronDown className="h-4 w-4" />
        </div>
        <button type="button" className="askai-new-thread" onClick={() => void newThread()}><Plus className="h-4 w-4" />Start new thread</button>
        <nav className="askai-primary-nav">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => { setView(id); setLeftOpen(false); }} className={cn(view === id && "is-active")}>
              <Icon className="h-[18px] w-[18px]" /><span>{label}</span>
              {id === "jobs" && jobs.filter((job) => job.enabled).length ? <em>{jobs.filter((job) => job.enabled).length}</em> : null}
            </button>
          ))}
        </nav>
        <div className="askai-sidebar-label">Recent threads</div>
        <div className="askai-thread-list">
          {conversations.length ? conversations.map((conversation) => (
            <div key={conversation.id} className={cn("askai-thread-row", activeId === conversation.id && "is-active")}>
              <button type="button" onClick={() => { setActiveId(conversation.id); setView("chat"); setLeftOpen(false); }}>{conversation.title}</button>
              <button type="button" aria-label="Delete thread" onClick={() => void removeConversation(conversation)}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          )) : <p className="askai-empty-small">Your conversations will appear here.</p>}
        </div>
        <div className="askai-sidebar-footer">
          <UserAvatar user={profile} size="sm" clickable={false} />
          <div><strong>{profile?.displayName || "Flux user"}</strong><span>{profile?.planTier || "free"} · {profile?.askAIUsage?.used || 0}/{profile?.askAIUsage?.limit || 20}</span></div>
          <button type="button" onClick={() => setSettingsOpen(true)} aria-label="AskAI settings"><Settings2 className="h-4 w-4" /></button>
          <div className="askai-usage"><i style={{ width: `${percent}%` }} /></div>
        </div>
      </aside>
      {leftOpen ? <button type="button" className="askai-scrim" onClick={() => setLeftOpen(false)} aria-label="Close navigation" /> : null}

      <section className="askai-main">
        <header className="askai-header">
          <button type="button" className="askai-mobile-button" onClick={() => setLeftOpen(true)} aria-label="Open workspace"><Menu className="h-5 w-5" /></button>
          <div className="askai-header-title"><span className="askai-agent-dot" style={{ background: selectedAgent?.color || "#6d5dfc" }}>{selectedAgent?.icon || "✦"}</span><div><strong>{view === "chat" ? (selectedAgent?.name || "AskAI") : VIEWS.find((item) => item.id === view)?.label}</strong><span>{view === "chat" ? "Agent workspace" : "Flux AskAI workspace"}</span></div></div>
          {view === "chat" ? <div className="askai-agent-picker-wrap"><button type="button" className="askai-agent-picker" onClick={() => setAgentMenuOpen((open) => !open)}>{selectedAgent?.name || "AskAI"}<ChevronDown className="h-3.5 w-3.5" /></button>{agentMenuOpen ? <div className="askai-agent-menu">{agents.map((agent) => <button key={agent.id} type="button" onClick={() => { setSelectedAgentId(agent.id); setAgentMenuOpen(false); }}><span style={{ background: agent.color }}>{agent.icon}</span><div><strong>{agent.name}</strong><small>{agent.description}</small></div>{selectedAgentId === agent.id ? <Check className="h-4 w-4" /> : null}</button>)}</div> : null}</div> : null}
          <div className="askai-header-actions">
            <span className={cn("askai-engine-chip", endpoint ? "is-online" : localAskAISupported() ? "is-local" : "is-instant")}>
              {endpoint ? <Cloud className="h-3.5 w-3.5" /> : localAskAISupported() ? <MemoryStick className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {endpoint ? "Connected" : localAskAISupported() ? "Local ready" : "Instant local"}
            </span>
            <button type="button" className="askai-mobile-button" onClick={() => setRightOpen(true)} aria-label="Open activity"><Wrench className="h-5 w-5" /></button>
            <button type="button" className="askai-icon-button" onClick={() => setSettingsOpen(true)} aria-label="Settings"><Settings2 className="h-4 w-4" /></button>
          </div>
        </header>

        {view === "chat" ? (
          <div className="askai-chat-stage">
            <div className="askai-message-scroll">
              {!hasThread ? <Welcome selectedAgent={selectedAgent} onPrompt={(prompt) => void send(prompt)} /> : null}
              {messages.map((message) => <ChatMessage key={message.id} message={message} profile={profile} agent={selectedAgent} onSpeak={speak} />)}
              {streamingText ? <AssistantStreaming text={streamingText} agent={selectedAgent} /> : null}
              {loading && !streamingText ? <Thinking status={status} progress={progress} agent={selectedAgent} /> : null}
              {pendingAction ? <ApprovalCard action={pendingAction} onApprove={() => void approvePending()} onCancel={() => setPendingAction(null)} /> : null}
              {results.length ? <SearchResults results={results} /> : null}
              {artifacts.length ? <ArtifactStrip artifacts={artifacts} onOpenView={(nextView) => setView(nextView)} /> : null}
              <div ref={bottomRef} />
            </div>
            <Composer
              input={input}
              setInput={setInput}
              loading={loading}
              listening={listening}
              status={status}
              selectedFiles={selectedFiles}
              engine={settings.engine}
              onEngine={(engine) => updateSettings({ engine })}
              onSend={() => void send()}
              onStop={stop}
              onVoice={toggleVoice}
              onAttach={() => fileInputRef.current?.click()}
              onRemoveFile={(id) => setSelectedFileIds((current) => current.filter((item) => item !== id))}
            />
            <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => void handleFiles(event)} accept="image/*,.txt,.md,.json,.csv,.html,.css,.js,.ts,.tsx,.jsx,.pdf" />
          </div>
        ) : null}

        {view === "agents" ? <AgentsView agents={agents} draft={agentDraft} setDraft={setAgentDraft} onSave={saveAgentDraft} onSelect={(id) => { setSelectedAgentId(id); setView("chat"); }} onDelete={(id) => { deleteAskAIAgent(id); refreshWorkspace(); }} /> : null}
        {view === "jobs" ? <JobsView jobs={jobs} draft={jobDraft} setDraft={setJobDraft} onSave={saveJobDraft} onRun={(id) => { runAskAIJob(id); refreshWorkspace(); toast.success("Job queued locally"); }} onDelete={(id) => { deleteAskAIJob(id); refreshWorkspace(); }} /> : null}
        {view === "miniapps" ? <MiniappsView apps={miniapps} prompt={miniappPrompt} setPrompt={setMiniappPrompt} onCreate={() => { if (!miniappPrompt.trim()) return; createAskAIMiniapp(miniappPrompt); setMiniappPrompt(""); refreshWorkspace(); }} onChange={(id, data) => { updateAskAIMiniapp(id, data); refreshWorkspace(); }} onDelete={(id) => { deleteAskAIMiniapp(id); refreshWorkspace(); }} /> : null}
        {view === "files" ? <FilesView files={files} selected={selectedFileIds} onToggle={(id) => setSelectedFileIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} onUpload={() => fileInputRef.current?.click()} onDelete={(id) => { deleteAskAIFile(id); setSelectedFileIds((current) => current.filter((item) => item !== id)); refreshWorkspace(); }} /> : null}
        {view === "memory" ? <MemoryView memories={memories} value={memoryDraft} setValue={setMemoryDraft} onSave={saveMemoryDraft} onDelete={(id) => { deleteAskAIMemory(id); refreshWorkspace(); }} /> : null}
      </section>

      <aside className={cn("askai-context-panel", rightOpen && "is-open")}>
        <div className="askai-context-header"><div><strong>Workspace activity</strong><span>Live tool and engine status</span></div><button type="button" onClick={() => setRightOpen(false)} aria-label="Close activity"><X className="h-4 w-4" /></button></div>
        <section className="askai-context-section"><h3>Active agent</h3>{selectedAgent ? <div className="askai-agent-summary"><span style={{ background: selectedAgent.color }}>{selectedAgent.icon}</span><div><strong>{selectedAgent.name}</strong><p>{selectedAgent.description}</p></div></div> : null}<div className="askai-tool-grid">{selectedAgent?.tools.map((tool) => <span key={tool}>{TOOL_LABELS[tool]}</span>)}</div></section>
        <section className="askai-context-section"><h3>Recent activity</h3><div className="askai-activity-list">{activities.length ? activities.map((item) => <div key={item.id} className={cn("askai-activity", `is-${item.status}`)}><span>{item.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.status === "done" ? <Check className="h-3.5 w-3.5" /> : item.status === "error" ? <X className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}</span><div><strong>{item.label}</strong><p>{item.detail}</p></div></div>) : <p className="askai-empty-small">Tool calls and actions appear here while AskAI works.</p>}</div></section>
        <section className="askai-context-section"><h3>Workspace</h3><div className="askai-stat-grid"><Stat label="Agents" value={agents.length} /><Stat label="Jobs" value={jobs.length} /><Stat label="Miniapps" value={miniapps.length} /><Stat label="Files" value={files.length} /></div></section>
        <section className="askai-context-section askai-trust"><ShieldCheck className="h-5 w-5" /><div><strong>Actions stay visible</strong><p>AskAI shows tool activity and asks before creating or changing Flux content when approvals are enabled.</p></div></section>
      </aside>
      {rightOpen ? <button type="button" className="askai-scrim askai-right-scrim" onClick={() => setRightOpen(false)} aria-label="Close activity" /> : null}

      {settingsOpen ? <SettingsDialog settings={settings} endpoint={endpoint} localSupported={localAskAISupported()} onChange={updateSettings} onClose={() => setSettingsOpen(false)} /> : null}
    </main>
  );
}

function Welcome({ selectedAgent, onPrompt }: { selectedAgent?: AskAIWorkspaceAgent; onPrompt: (prompt: string) => void }) {
  return <div className="askai-welcome"><div className="askai-welcome-symbol" style={{ background: selectedAgent?.color || "#6d5dfc" }}>{selectedAgent?.icon || "✦"}</div><h1>What should we work on?</h1><p>{selectedAgent?.description || "Ask questions, create things and run Flux actions from one conversation."}</p><div className="askai-starter-grid">{STARTERS.map(({ title, prompt, icon: Icon }) => <button key={title} type="button" onClick={() => onPrompt(prompt)}><Icon className="h-4 w-4" /><strong>{title}</strong><span>{prompt}</span></button>)}</div></div>;
}

function ChatMessage({ message, profile, agent, onSpeak }: { message: AIMessage; profile: ReturnType<typeof useAuth>["profile"]; agent?: AskAIWorkspaceAgent; onSpeak: (text: string) => void }) {
  const assistant = message.role === "assistant";
  return <article className={cn("askai-message", assistant ? "is-assistant" : "is-user")}><div className="askai-message-avatar">{assistant ? <span style={{ background: agent?.color || "#6d5dfc" }}>{agent?.icon || "✦"}</span> : <UserAvatar user={profile} size="sm" clickable={false} />}</div><div className="askai-message-content"><div className="askai-message-meta"><strong>{assistant ? agent?.name || "AskAI" : profile?.displayName || "You"}</strong><span>{assistant ? engineLabel(message.meta?.engine) : "You"}</span></div><div className="askai-markdown"><ReactMarkdown>{message.content}</ReactMarkdown></div>{assistant ? <div className="askai-message-actions"><button type="button" onClick={() => void navigator.clipboard?.writeText(message.content)}><Copy className="h-3.5 w-3.5" />Copy</button><button type="button" onClick={() => onSpeak(message.content)}><Volume2 className="h-3.5 w-3.5" />Listen</button></div> : null}</div></article>;
}

function AssistantStreaming({ text, agent }: { text: string; agent?: AskAIWorkspaceAgent }) {
  return <article className="askai-message is-assistant"><div className="askai-message-avatar"><span style={{ background: agent?.color || "#6d5dfc" }}>{agent?.icon || "✦"}</span></div><div className="askai-message-content"><div className="askai-message-meta"><strong>{agent?.name || "AskAI"}</strong><span>Local model</span></div><div className="askai-markdown"><ReactMarkdown>{text}</ReactMarkdown><i className="askai-cursor" /></div></div></article>;
}

function Thinking({ status, progress, agent }: { status: string | null; progress: number | null; agent?: AskAIWorkspaceAgent }) {
  return <article className="askai-message is-assistant"><div className="askai-message-avatar"><span style={{ background: agent?.color || "#6d5dfc" }}>{agent?.icon || "✦"}</span></div><div className="askai-message-content"><div className="askai-thinking"><Loader2 className="h-4 w-4 animate-spin" /><div><strong>{status || "AskAI is working…"}</strong>{progress !== null ? <div className="askai-progress"><i style={{ width: `${progress}%` }} /></div> : null}</div></div></div></article>;
}

function ApprovalCard({ action, onApprove, onCancel }: { action: PendingAction; onApprove: () => void; onCancel: () => void }) {
  return <div className="askai-approval"><div className="askai-approval-icon"><ShieldCheck className="h-5 w-5" /></div><div><strong>{action.title}</strong><p>{action.description}</p><div><button type="button" className="primary" onClick={onApprove}><Check className="h-4 w-4" />Approve</button><button type="button" onClick={onCancel}><X className="h-4 w-4" />Cancel</button></div></div></div>;
}

function SearchResults({ results }: { results: FluxSearchResult[] }) {
  return <section className="askai-results"><div className="askai-section-heading"><div><strong>Flux results</strong><span>{results.length} public matches</span></div><Search className="h-4 w-4" /></div><div className="askai-result-list">{results.slice(0, 12).map((result) => <Link key={`${result.type}-${result.id}`} href={result.href} className="askai-result-row"><span>{result.type === "user" ? <Bot className="h-4 w-4" /> : result.type === "post" ? <MessageSquareText className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}</span><div><strong>{result.title}</strong><p>{result.description}</p></div></Link>)}</div></section>;
}

function ArtifactStrip({ artifacts, onOpenView }: { artifacts: Artifact[]; onOpenView: (view: AskAIWorkspaceView) => void }) {
  return <section className="askai-artifacts">{artifacts.map((artifact) => { const targetView: AskAIWorkspaceView | null = artifact.type === "agent" ? "agents" : artifact.type === "job" ? "jobs" : artifact.type === "miniapp" ? "miniapps" : artifact.type === "memory" ? "memory" : null; const body = <><span><Zap className="h-4 w-4" /></span><div><strong>{artifact.title}</strong><p>{artifact.description}</p></div></>; return artifact.href ? <Link key={artifact.id} href={artifact.href}>{body}</Link> : <button key={artifact.id} type="button" onClick={() => targetView && onOpenView(targetView)}>{body}</button>; })}</section>;
}

function Composer({ input, setInput, loading, listening, status, selectedFiles, engine, onEngine, onSend, onStop, onVoice, onAttach, onRemoveFile }: {
  input: string;
  setInput: (value: string) => void;
  loading: boolean;
  listening: boolean;
  status: string | null;
  selectedFiles: AskAIWorkspaceFile[];
  engine: AskAIWorkspaceSettings["engine"];
  onEngine: (engine: AskAIWorkspaceSettings["engine"]) => void;
  onSend: () => void;
  onStop: () => void;
  onVoice: () => void;
  onAttach: () => void;
  onRemoveFile: (id: string) => void;
}) {
  const submit = (event: FormEvent) => { event.preventDefault(); if (loading) onStop(); else onSend(); };
  return <div className="askai-composer-wrap">{selectedFiles.length ? <div className="askai-selected-files">{selectedFiles.map((file) => <span key={file.id}>{file.type.startsWith("image/") ? <ImageIcon className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}{file.name}<button type="button" onClick={() => onRemoveFile(file.id)}><X className="h-3 w-3" /></button></span>)}</div> : null}<form className="askai-composer" onSubmit={submit}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (loading) onStop(); else onSend(); } }} placeholder="Ask anything, hand off work, or create something…" rows={1} /><div className="askai-composer-toolbar"><div><button type="button" onClick={onAttach} aria-label="Attach files"><Paperclip className="h-4 w-4" /></button><button type="button" onClick={onVoice} className={cn(listening && "is-active")} aria-label="Voice input"><Mic className="h-4 w-4" /></button><label className="askai-engine-select"><Sparkles className="h-3.5 w-3.5" /><select value={engine} onChange={(event) => onEngine(event.target.value as AskAIWorkspaceSettings["engine"])}><option value="auto">Auto route</option><option value="local">Smart local</option><option value="instant">Instant local</option><option value="remote">Connected model</option></select></label></div><button type="submit" className="askai-send" disabled={!loading && !input.trim()}>{loading ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-4 w-4" />}</button></div></form><p className="askai-composer-note">{status || "AskAI can make mistakes. Review important actions and information."}</p></div>;
}

function AgentsView({ agents, draft, setDraft, onSave, onSelect, onDelete }: {
  agents: AskAIWorkspaceAgent[];
  draft: { name: string; description: string; instructions: string; tools: AskAIToolId[] };
  setDraft: (value: { name: string; description: string; instructions: string; tools: AskAIToolId[] }) => void;
  onSave: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return <WorkspacePage title="Agents" description="Specialist AI workers with their own instructions, tools and memory access." action={<button type="button" className="askai-page-action" onClick={onSave}><Plus className="h-4 w-4" />Create agent</button>}><div className="askai-builder-panel"><div className="askai-form-grid"><Field label="Name"><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Research assistant" /></Field><Field label="Description"><input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="What this agent is for" /></Field></div><Field label="Instructions"><textarea value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Role, rules and expected output" rows={3} /></Field><div className="askai-tool-checkboxes">{Object.entries(TOOL_LABELS).map(([id, label]) => <label key={id}><input type="checkbox" checked={draft.tools.includes(id as AskAIToolId)} onChange={(event) => setDraft({ ...draft, tools: event.target.checked ? [...draft.tools, id as AskAIToolId] : draft.tools.filter((tool) => tool !== id) })} />{label}</label>)}</div></div><div className="askai-agent-cards">{agents.map((agent) => <article key={agent.id}><div className="askai-agent-card-top"><span style={{ background: agent.color }}>{agent.icon}</span><div><strong>{agent.name}</strong><p>{agent.description}</p></div><button type="button" aria-label="More"><MoreHorizontal className="h-4 w-4" /></button></div><div className="askai-tool-grid">{agent.tools.map((tool) => <span key={tool}>{TOOL_LABELS[tool]}</span>)}</div><div className="askai-card-actions"><button type="button" className="primary" onClick={() => onSelect(agent.id)}>Open chat</button>{!agent.isDefault ? <button type="button" onClick={() => onDelete(agent.id)}><Trash2 className="h-4 w-4" />Delete</button> : null}</div></article>)}</div></WorkspacePage>;
}

function JobsView({ jobs, draft, setDraft, onSave, onRun, onDelete }: {
  jobs: AskAIWorkspaceJob[];
  draft: { title: string; prompt: string; schedule: string };
  setDraft: (value: { title: string; prompt: string; schedule: string }) => void;
  onSave: () => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return <WorkspacePage title="Jobs" description="Save repeatable instructions and schedules. Local jobs are transparent and never pretend to run while Flux is closed." action={<button type="button" className="askai-page-action" onClick={onSave}><Plus className="h-4 w-4" />Save job</button>}><div className="askai-builder-panel"><div className="askai-form-grid"><Field label="Job name"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Morning creator brief" /></Field><Field label="Schedule"><select value={draft.schedule} onChange={(event) => setDraft({ ...draft, schedule: event.target.value })}><option>Manual</option><option>Every morning</option><option>Every evening</option><option>Every Monday</option><option>Every hour while Flux is open</option></select></Field></div><Field label="Instruction"><textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} placeholder="Summarize my Flux notifications and suggest what needs a reply." rows={3} /></Field></div><div className="askai-job-list">{jobs.length ? jobs.map((job) => <article key={job.id}><span className={cn("askai-job-status", job.enabled && "is-enabled")}><Clock3 className="h-4 w-4" /></span><div><strong>{job.title}</strong><p>{job.prompt}</p><small>{job.schedule}{job.lastRunAt ? ` · last run ${new Date(job.lastRunAt).toLocaleString()}` : ""}</small></div><div><button type="button" className="primary" onClick={() => onRun(job.id)}><Play className="h-4 w-4" />Run now</button><button type="button" onClick={() => onDelete(job.id)}><Trash2 className="h-4 w-4" /></button></div></article>) : <EmptyWorkspace icon={Clock3} title="No jobs yet" text="Create a reusable instruction and run it whenever you need it." />}</div></WorkspacePage>;
}

function MiniappsView({ apps, prompt, setPrompt, onCreate, onChange, onDelete }: { apps: AskAIMiniapp[]; prompt: string; setPrompt: (value: string) => void; onCreate: () => void; onChange: (id: string, data: Record<string, unknown>) => void; onDelete: (id: string) => void }) {
  return <WorkspacePage title="Miniapps" description="Small interactive tools built from a prompt and stored in your workspace." action={<button type="button" className="askai-page-action" onClick={onCreate}><WandSparkles className="h-4 w-4" />Build miniapp</button>}><div className="askai-miniapp-prompt"><LayoutDashboard className="h-5 w-5" /><input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Create a poll, checklist, counter, notes tool or decision board…" /><button type="button" onClick={onCreate}>Build</button></div>{apps.length ? <div className="askai-miniapp-grid">{apps.map((app) => <MiniappCard key={app.id} app={app} onChange={(data) => onChange(app.id, data)} onDelete={() => onDelete(app.id)} />)}</div> : <EmptyWorkspace icon={LayoutDashboard} title="No miniapps yet" text="Describe a small tool and AskAI will build a working local version." />}</WorkspacePage>;
}

function MiniappCard({ app, onChange, onDelete }: { app: AskAIMiniapp; onChange: (data: Record<string, unknown>) => void; onDelete: () => void }) {
  return <article className="askai-miniapp-card"><header><div><strong>{app.title}</strong><span>{app.type}</span></div><button type="button" onClick={onDelete}><Trash2 className="h-4 w-4" /></button></header><p>{app.description}</p><div className="askai-miniapp-body">{app.type === "counter" ? <CounterMiniapp data={app.data} onChange={onChange} /> : app.type === "poll" ? <PollMiniapp data={app.data} onChange={onChange} /> : app.type === "notes" ? <NotesMiniapp data={app.data} onChange={onChange} /> : app.type === "decision" ? <DecisionMiniapp data={app.data} onChange={onChange} /> : <ChecklistMiniapp data={app.data} onChange={onChange} />}</div></article>;
}

function CounterMiniapp({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  const value = Number(data.value || 0); const step = Number(data.step || 1);
  return <div className="mini-counter"><button type="button" onClick={() => onChange({ ...data, value: value - step })}>−</button><strong>{value}</strong><button type="button" onClick={() => onChange({ ...data, value: value + step })}>+</button></div>;
}

function PollMiniapp({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  const options = Array.isArray(data.options) ? data.options.map(String) : [];
  const votes = Array.isArray(data.votes) ? data.votes.map(Number) : options.map(() => 0);
  const total = votes.reduce((sum, value) => sum + value, 0);
  return <div className="mini-poll">{options.map((option, index) => <button key={`${option}-${index}`} type="button" onClick={() => { const next = [...votes]; next[index] = (next[index] || 0) + 1; onChange({ ...data, votes: next }); }}><span>{option}</span><i style={{ width: `${total ? Math.round((votes[index] || 0) / total * 100) : 0}%` }} /><em>{votes[index] || 0}</em></button>)}</div>;
}

function NotesMiniapp({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  return <textarea value={String(data.text || "")} onChange={(event) => onChange({ ...data, text: event.target.value })} placeholder="Write notes…" rows={8} />;
}

function DecisionMiniapp({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  const options = Array.isArray(data.options) ? data.options.map(String) : ["Choice A", "Choice B"];
  const scores = Array.isArray(data.scores) ? data.scores as number[][] : [[3, 3, 3], [3, 3, 3]];
  return <div className="mini-decision">{options.map((option, optionIndex) => <div key={option}><strong>{option}</strong><div>{[0, 1, 2].map((scoreIndex) => <input key={scoreIndex} type="range" min="1" max="5" value={scores[optionIndex]?.[scoreIndex] || 3} onChange={(event) => { const next = scores.map((row) => [...row]); next[optionIndex] ||= [3, 3, 3]; next[optionIndex][scoreIndex] = Number(event.target.value); onChange({ ...data, scores: next }); }} />)}</div><em>{(scores[optionIndex] || []).reduce((sum, value) => sum + value, 0)}</em></div>)}</div>;
}

function ChecklistMiniapp({ data, onChange }: { data: Record<string, unknown>; onChange: (data: Record<string, unknown>) => void }) {
  const items = Array.isArray(data.items) ? data.items as Array<{ id: string; text: string; done: boolean }> : [];
  return <div className="mini-checklist">{items.map((item) => <label key={item.id}><input type="checkbox" checked={item.done} onChange={() => onChange({ ...data, items: items.map((current) => current.id === item.id ? { ...current, done: !current.done } : current) })} /><span>{item.text}</span></label>)}<button type="button" onClick={() => onChange({ ...data, items: [...items, { id: `task-${Date.now()}`, text: `Task ${items.length + 1}`, done: false }] })}><Plus className="h-3.5 w-3.5" />Add item</button></div>;
}

function FilesView({ files, selected, onToggle, onUpload, onDelete }: { files: AskAIWorkspaceFile[]; selected: string[]; onToggle: (id: string) => void; onUpload: () => void; onDelete: (id: string) => void }) {
  return <WorkspacePage title="Files" description="Attach text, code, data and images to the workspace. Text content stays available to local agents." action={<button type="button" className="askai-page-action" onClick={onUpload}><Paperclip className="h-4 w-4" />Upload files</button>}>{files.length ? <div className="askai-file-grid">{files.map((file) => <article key={file.id} className={cn(selected.includes(file.id) && "is-selected")}><button type="button" className="askai-file-preview" onClick={() => onToggle(file.id)}>{file.dataUrl ? <img src={file.dataUrl} alt="" /> : file.type.startsWith("image/") ? <ImageIcon className="h-8 w-8" /> : <FileText className="h-8 w-8" />}{selected.includes(file.id) ? <span><Check className="h-3.5 w-3.5" /></span> : null}</button><div><strong>{file.name}</strong><small>{formatBytes(file.size)} · {file.text ? "text ready" : file.type || "file"}</small></div><button type="button" onClick={() => onDelete(file.id)}><Trash2 className="h-4 w-4" /></button></article>)}</div> : <EmptyWorkspace icon={FolderOpen} title="No workspace files" text="Upload text, code, data or images and attach them to any AskAI thread." />}</WorkspacePage>;
}

function MemoryView({ memories, value, setValue, onSave, onDelete }: { memories: AskAIMemory[]; value: string; setValue: (value: string) => void; onSave: () => void; onDelete: (id: string) => void }) {
  return <WorkspacePage title="Memory" description="Facts saved here are added to local agent context so you do not have to repeat them." action={<button type="button" className="askai-page-action" onClick={onSave}><Brain className="h-4 w-4" />Save memory</button>}><div className="askai-memory-form"><Brain className="h-5 w-5" /><textarea value={value} onChange={(event) => setValue(event.target.value)} placeholder="Remember that our main project is Flux and the preferred style is…" rows={3} /><button type="button" onClick={onSave}>Save</button></div>{memories.length ? <div className="askai-memory-list">{memories.map((memory) => <article key={memory.id}><span><Brain className="h-4 w-4" /></span><div><p>{memory.text}</p><small>{memory.scope} · {new Date(memory.createdAt).toLocaleDateString()}</small></div><button type="button" onClick={() => onDelete(memory.id)}><Trash2 className="h-4 w-4" /></button></article>)}</div> : <EmptyWorkspace icon={Brain} title="No saved memory" text="Save project context, preferences or recurring facts for AskAI to use later." />}</WorkspacePage>;
}

function WorkspacePage({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <div className="askai-workspace-page"><header><div><h1>{title}</h1><p>{description}</p></div>{action}</header><div className="askai-workspace-content">{children}</div></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="askai-field"><span>{label}</span>{children}</label>;
}

function EmptyWorkspace({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <div className="askai-empty-workspace"><Icon className="h-8 w-8" /><strong>{title}</strong><p>{text}</p></div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function SettingsDialog({ settings, endpoint, localSupported, onChange, onClose }: { settings: AskAIWorkspaceSettings; endpoint: string | null; localSupported: boolean; onChange: (patch: Partial<AskAIWorkspaceSettings>) => void; onClose: () => void }) {
  return <div className="askai-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="askai-settings-dialog" role="dialog" aria-modal="true"><header><div><strong>AskAI settings</strong><span>Engine, voice and action safety</span></div><button type="button" onClick={onClose}><X className="h-4 w-4" /></button></header><div className="askai-settings-body"><Field label="Default engine"><select value={settings.engine} onChange={(event) => onChange({ engine: event.target.value as AskAIWorkspaceSettings["engine"] })}><option value="auto">Auto route</option><option value="local">Smart local WebGPU</option><option value="instant">Instant local</option><option value="remote">Connected endpoint</option></select></Field><SettingToggle icon={ShieldCheck} label="Confirm actions" description="Ask before creating groups, agents, jobs, projects or miniapps." checked={settings.confirmActions} onChange={(checked) => onChange({ confirmActions: checked })} /><SettingToggle icon={Volume2} label="Speak replies" description="Read completed AskAI replies aloud using your device voice." checked={settings.speakReplies} onChange={(checked) => onChange({ speakReplies: checked })} /><div className="askai-engine-status"><div className={endpoint ? "online" : "offline"}>{endpoint ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}<span><strong>Connected model</strong><small>{endpoint ? "Endpoint detected" : "No endpoint configured"}</small></span></div><div className={localSupported ? "online" : "offline"}>{localSupported ? <MemoryStick className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}<span><strong>Smart local model</strong><small>{localSupported ? "WebGPU available" : "WebGPU unavailable in this browser"}</small></span></div></div></div><footer><button type="button" onClick={onClose}>Done</button></footer></section></div>;
}

function SettingToggle({ icon: Icon, label, description, checked, onChange }: { icon: LucideIcon; label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="askai-setting-toggle"><Icon className="h-5 w-5" /><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function detectIntent(text: string): "search" | "game" | "website" | "group" | "agent" | "job" | "miniapp" | "memory" | "answer" {
  const lower = text.toLowerCase();
  if (/^(search|find|look up)\b/.test(lower) && /\bflux\b/.test(lower)) return "search";
  if (/\b(build|create|make|generate)\b/.test(lower) && /\b(game|obby|simulator|tycoon)\b/.test(lower)) return "game";
  if (/\b(build|create|make|generate)\b/.test(lower) && /\b(website|site|landing page|web app)\b/.test(lower)) return "website";
  if (/\b(create|make|start)\b/.test(lower) && /\b(group|community)\b/.test(lower)) return "group";
  if (/\b(create|make|build)\b/.test(lower) && /\bagent\b/.test(lower)) return "agent";
  if (/\b(create|schedule|make)\b/.test(lower) && /\b(job|automation|every morning|every day|weekly|hourly)\b/.test(lower)) return "job";
  if (/\b(create|build|make)\b/.test(lower) && /\b(miniapp|mini app|checklist|poll|counter|decision board)\b/.test(lower)) return "miniapp";
  if (/^(remember|save to memory|remember that)\b/.test(lower)) return "memory";
  return "answer";
}

function approvalTitle(intent: ReturnType<typeof detectIntent>): string {
  if (intent === "game" || intent === "website") return "Create a Studio project";
  if (intent === "group") return "Create a Flux group";
  if (intent === "agent") return "Create an agent";
  if (intent === "job") return "Create a job";
  if (intent === "miniapp") return "Build a miniapp";
  return "Run this action";
}

function extractNamedThing(text: string, type: string): string | null {
  const match = text.match(new RegExp(`${type}\\s+(?:called|named)?\\s*["']?([^"'.]{2,60})`, "i"));
  return match?.[1]?.replace(/\b(that|which|to|with)\b.*$/i, "").trim().slice(0, 60) || null;
}

function extractSchedule(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("every hour") || lower.includes("hourly")) return "Every hour while Flux is open";
  if (lower.includes("every morning") || lower.includes("daily morning")) return "Every morning";
  if (lower.includes("every evening")) return "Every evening";
  if (lower.includes("every monday") || lower.includes("weekly")) return "Every Monday";
  if (lower.includes("every day") || lower.includes("daily")) return "Every day";
  return "Manual";
}

function titleFromText(text: string, fallback: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact ? compact.split(" ").slice(0, 8).join(" ").slice(0, 60) : fallback;
}

function resolveEndpoint(): string | null {
  const value = process.env.NEXT_PUBLIC_ASKAI_ENDPOINT || process.env.NEXT_PUBLIC_AI_ENDPOINT || process.env.NEXT_PUBLIC_FLUX_AI_URL || "";
  return value.trim() || null;
}

async function askRemote(input: { endpoint: string; text: string; history: AIMessage[]; context: string; signal: AbortSignal }): Promise<string> {
  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: input.signal,
    body: JSON.stringify({
      message: input.text,
      context: input.context,
      history: input.history.slice(-16).map((message) => ({ role: message.role, content: message.content })),
    }),
  });
  if (!response.ok) throw new Error(`Connected AskAI returned ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json() as Record<string, unknown>;
    const choice = Array.isArray(data.choices) ? data.choices[0] as Record<string, unknown> | undefined : undefined;
    const message = choice?.message as Record<string, unknown> | undefined;
    const value = data.answer || data.message || data.content || data.text || message?.content;
    if (typeof value === "string" && value.trim()) return value.trim();
    throw new Error("Connected AskAI returned an empty response.");
  }
  const text = await response.text();
  if (!text.trim()) throw new Error("Connected AskAI returned an empty response.");
  if (!contentType.includes("text/event-stream")) return text.trim();
  return text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).filter((line) => line && line !== "[DONE]").map((line) => { try { const data = JSON.parse(line) as Record<string, unknown>; const choices = Array.isArray(data.choices) ? data.choices : []; const first = choices[0] as Record<string, unknown> | undefined; const delta = first?.delta as Record<string, unknown> | undefined; return String(delta?.content || data.content || data.text || ""); } catch { return line; } }).join("").trim();
}

function engineLabel(value: unknown): string {
  if (value === "remote") return "Connected model";
  if (value === "local-webgpu") return "Private local model";
  if (value === "instant-local") return "Instant local";
  return "AskAI";
}

function stripMarkdown(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "code block").replace(/[*_#>`~-]/g, " ").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\s+/g, " ").trim();
}

async function extractFileText(file: File): Promise<string> {
  const textLike = file.type.startsWith("text/") || /\.(txt|md|json|csv|html|css|js|ts|tsx|jsx)$/i.test(file.name);
  if (!textLike) return "";
  if (file.size > 2_000_000) throw new Error("Text files must be under 2 MB.");
  return (await file.text()).slice(0, 200_000);
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function localConversationKey(uid: string): string { return `flux-askai-local-conversations-${uid}`; }
function localMessagesKey(uid: string, id: string): string { return `flux-askai-local-messages-${uid}-${id}`; }

function readLocalConversations(uid: string): AIConversation[] {
  try { return JSON.parse(localStorage.getItem(localConversationKey(uid)) || "[]") as AIConversation[]; } catch { return []; }
}

function saveLocalConversation(uid: string, conversation: AIConversation): void {
  const current = readLocalConversations(uid).filter((item) => item.id !== conversation.id);
  localStorage.setItem(localConversationKey(uid), JSON.stringify([conversation, ...current].slice(0, 50)));
}

function renameLocalConversation(uid: string, id: string, title: string): void {
  const current = readLocalConversations(uid);
  const existing = current.find((item) => item.id === id) || { id, userId: uid, title, updatedAt: null, createdAt: Date.now() };
  saveLocalConversation(uid, { ...existing, title: title.slice(0, 80) });
}

function deleteLocalConversation(uid: string, id: string): void {
  localStorage.setItem(localConversationKey(uid), JSON.stringify(readLocalConversations(uid).filter((item) => item.id !== id)));
  localStorage.removeItem(localMessagesKey(uid, id));
}

function readLocalMessages(uid: string, id: string): AIMessage[] {
  try { return JSON.parse(localStorage.getItem(localMessagesKey(uid, id)) || "[]") as AIMessage[]; } catch { return []; }
}

function saveLocalMessage(uid: string, id: string, message: AIMessage): void {
  const current = readLocalMessages(uid, id);
  localStorage.setItem(localMessagesKey(uid, id), JSON.stringify([...current, message].slice(-150)));
  const conversation = readLocalConversations(uid).find((item) => item.id === id);
  if (conversation) saveLocalConversation(uid, conversation);
}

function conversationTime(conversation: AIConversation): number {
  if (typeof conversation.updatedAt?.toMillis === "function") return conversation.updatedAt.toMillis();
  return typeof conversation.createdAt === "number" ? conversation.createdAt : 0;
}
