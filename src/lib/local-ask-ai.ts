export type LocalAskAIIntent =
  | "conversation"
  | "flux-help"
  | "rewrite"
  | "summarize"
  | "caption"
  | "hashtags"
  | "brainstorm"
  | "plan"
  | "explain"
  | "general";

export interface LocalAskAIResult {
  intent: LocalAskAIIntent;
  title: string;
  answer: string;
  suggestions: string[];
}

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "but", "can", "could",
  "does", "doing", "for", "from", "have", "here", "into", "just", "like", "make", "more", "need", "not", "only",
  "our", "should", "some", "than", "that", "the", "their", "them", "then", "there", "these", "they", "this", "those",
  "through", "too", "use", "using", "very", "want", "what", "when", "where", "which", "while", "with", "would", "your",
]);

const FLUX_HELP: Array<{ test: RegExp; answer: string }> = [
  {
    test: /\b(story|stories)\b/i,
    answer: "Open Stories and choose Create Story. Add media or a background, then add movable text, stickers, shapes and music. Select any layer to move, resize, rotate, reorder, lock, hide, duplicate or delete it before publishing.",
  },
  {
    test: /\b(live|stream|screen share)\b/i,
    answer: "Flux Live supports camera and microphone in secure browsers. Desktop browsers can also expose screen capture. iPhone and iPad web browsers do not provide normal webpage screen broadcasting, so Flux hides that unavailable control instead of pretending it works.",
  },
  {
    test: /\b(studio|engine|game|website)\b/i,
    answer: "Flux Studio now contains Flux Engine: a real Babylon.js WebGL editor with a 3D viewport, hierarchy, transform gizmos, materials, lights, physics, scripts, play mode, GLB importing, project versions and publishing into Flux Games.",
  },
  {
    test: /\b(group|community)\b/i,
    answer: "Groups are Flux community spaces for focused posts and members. AskAI can create your owned group after you approve the action, or you can open Groups and manage it manually.",
  },
  {
    test: /\b(gift|coin|reward|premium)\b/i,
    answer: "Flux Gifts use Flux Coins. The sender chooses an animated vector gift and recipient; the recipient claims the creator value from their own inbox. Premium and Rewards live in the Coins section of the menu.",
  },
  {
    test: /\b(message|chat|dm)\b/i,
    answer: "Messages supports direct and group conversations. Story replies open Messages with the Story context attached so the reply stays connected to what the person shared.",
  },
  {
    test: /\b(askai|agent|job|miniapp|memory)\b/i,
    answer: "AskAI is a workspace rather than one fixed chat. You can select or create agents, attach files, save memory, build miniapps, save repeatable jobs and review every tool action. It can use a connected model, a private WebGPU model in your browser or an instant local fallback.",
  },
];

export function runLocalAskAI(prompt: string): LocalAskAIResult {
  const clean = prompt.trim();
  const lower = clean.toLowerCase().replace(/[!?.,]+$/g, "").trim();

  const conversation = conversationalResponse(lower);
  if (conversation) return conversation;

  if (/\b(how (do|can) i|where (is|are)|help (me )?(with|use)|what is flux|what can flux)\b/.test(lower)) {
    return fluxHelp(clean);
  }
  if (/^(rewrite|rephrase|improve|fix grammar|make this sound)/i.test(clean)) {
    return rewriteText(extractPayload(clean));
  }
  if (/^(summarize|summary|shorten|tldr|tl;dr)/i.test(clean)) {
    return summarizeText(extractPayload(clean));
  }
  if (/\b(caption|post caption|social caption)\b/i.test(clean)) {
    return createCaptions(extractPayload(clean));
  }
  if (/\b(hashtag|hashtags|tags for)\b/i.test(clean)) {
    return createHashtags(extractPayload(clean));
  }
  if (/\b(brainstorm|ideas? for|give me ideas|content ideas)\b/i.test(clean)) {
    return brainstorm(extractPayload(clean));
  }
  if (/\b(plan|roadmap|steps|break down|checklist)\b/i.test(clean)) {
    return createPlan(extractPayload(clean));
  }
  if (/^(explain|what does|how does|why does|what are|what is)/i.test(clean)) {
    return explain(clean);
  }
  return generalResponse(clean);
}

function conversationalResponse(lower: string): LocalAskAIResult | null {
  if (/^(hi|hello|hey|yo|sup|what's up|whats up|good morning|good afternoon|good evening)$/.test(lower)) {
    return {
      intent: "conversation",
      title: "Hello",
      answer: "Hey! 👋 I’m here. What are we working on—Flux, a game, a post, research, code, or something completely different?",
      suggestions: ["Help me improve Flux", "Brainstorm a game", "Write a post"],
    };
  }
  if (/^(how are you|how are you doing|you good|are you okay)$/.test(lower)) {
    return {
      intent: "conversation",
      title: "Doing well",
      answer: "I’m doing well—awake, ready, and significantly less dramatic than a broken Firebase upload. 😄 What do you need?",
      suggestions: ["Help me with Flux", "Give me ideas", "Explain something"],
    };
  }
  if (/^(thanks|thank you|thx|ty|appreciate it)$/.test(lower)) {
    return {
      intent: "conversation",
      title: "Anytime",
      answer: "Anytime. What’s next?",
      suggestions: ["Start a new task", "Create a plan", "Write a caption"],
    };
  }
  if (/^(who are you|what are you|what is askai)$/.test(lower)) {
    return {
      intent: "conversation",
      title: "AskAI",
      answer: "I’m AskAI, the AI workspace inside Flux. I can chat, work with attached files, remember project context, use specialist agents, search public Flux content, create editable Studio projects, build miniapps and prepare approved Flux actions.",
      suggestions: ["Show me your features", "Create an agent", "Build a miniapp"],
    };
  }
  if (/^(bye|goodbye|see you|cya)$/.test(lower)) {
    return {
      intent: "conversation",
      title: "See you",
      answer: "See you soon 👋 Your threads, workspace memory and local tools will still be here.",
      suggestions: ["Start another thread", "Open Jobs", "Open Memory"],
    };
  }
  return null;
}

function fluxHelp(prompt: string): LocalAskAIResult {
  const item = FLUX_HELP.find((entry) => entry.test.test(prompt));
  const answer = item?.answer || "Flux combines posts, Stories, Live, Messages, Groups, Games, Studio, AskAI, gifts and creator tools in one account. Use AskAI as the command workspace, Studio for creation and the main navigation for social features.";
  return {
    intent: "flux-help",
    title: "Flux help",
    answer,
    suggestions: ["Show me how Stories work", "What can I build in Studio?", "What can AskAI do?"],
  };
}

function rewriteText(text: string): LocalAskAIResult {
  if (!text) return missingText("rewrite");
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
  const sentence = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  const result = /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
  return {
    intent: "rewrite",
    title: "Cleaner version",
    answer: result,
    suggestions: ["Make it more professional", "Make it shorter", "Turn it into a caption"],
  };
}

function summarizeText(text: string): LocalAskAIResult {
  if (!text) return missingText("summarize");
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const selected = sentences.length <= 3
    ? sentences
    : [sentences[0], sentences[Math.floor(sentences.length / 2)], sentences[sentences.length - 1]];
  const bullets = selected.map((sentence) => `- ${trimWords(sentence, 28)}`).join("\n");
  return {
    intent: "summarize",
    title: "Local summary",
    answer: bullets || trimWords(text, 70),
    suggestions: ["Make it one sentence", "Turn this into a post", "Extract hashtags"],
  };
}

function createCaptions(text: string): LocalAskAIResult {
  const subject = text || "this moment";
  const compact = trimWords(subject.replace(/^(for|about)\s+/i, ""), 16);
  const captions = [
    `${capitalize(compact)}. That is the post.`,
    `A little update: ${lowerFirst(compact)} ✨`,
    `${capitalize(compact)} — and we are only getting started.`,
    `Current mood: ${lowerFirst(compact)}.`,
    `${capitalize(compact)}. Thoughts?`,
  ];
  return {
    intent: "caption",
    title: "Caption ideas",
    answer: captions.map((item, index) => `${index + 1}. ${item}`).join("\n"),
    suggestions: ["Make them funnier", "Add hashtags", "Write a longer version"],
  };
}

function createHashtags(text: string): LocalAskAIResult {
  const keywords = extractKeywords(text || "flux creator community");
  const tags = [...new Set(["Flux", ...keywords.map(toHashtagWord), "Creator", "Community"])].slice(0, 10);
  return {
    intent: "hashtags",
    title: "Suggested hashtags",
    answer: tags.map((tag) => `#${tag}`).join(" "),
    suggestions: ["Make them gaming focused", "Create a caption too", "Use fewer tags"],
  };
}

function brainstorm(text: string): LocalAskAIResult {
  const topic = trimWords(text || "Flux content", 12);
  const ideas = [
    `A before-and-after post about ${topic}`,
    `A 15-second Story showing the most interesting part of ${topic}`,
    `A poll asking followers to choose the next direction for ${topic}`,
    `A short behind-the-scenes thread about how ${topic} was made`,
    `A Live session where people can ask questions about ${topic}`,
    `A community challenge built around ${topic}`,
    `A carousel sequence: problem, process, result and next step`,
    `A “three things I learned” post about ${topic}`,
  ];
  return {
    intent: "brainstorm",
    title: "Ideas",
    answer: ideas.map((idea, index) => `${index + 1}. ${idea}`).join("\n"),
    suggestions: ["Turn idea 1 into a caption", "Make a seven-day plan", "Give me gaming ideas"],
  };
}

function createPlan(text: string): LocalAskAIResult {
  const goal = trimWords(text || "the project", 18);
  const steps = [
    `Define the exact result for ${goal}`,
    "List the smallest version that is still useful",
    "Build the core interaction before adding decoration",
    "Test it on a phone-sized screen and desktop",
    "Fix broken states, permissions and loading errors",
    "Ask a real user to try the main workflow without help",
    "Publish, watch feedback and improve one problem at a time",
  ];
  return {
    intent: "plan",
    title: "Action plan",
    answer: steps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    suggestions: ["Make this a checklist", "Create milestones", "Summarize the plan"],
  };
}

function explain(text: string): LocalAskAIResult {
  const topic = text.replace(/^(explain|what does|how does|why does|what are|what is)\s+/i, "").replace(/[?]+$/, "").trim();
  return {
    intent: "explain",
    title: topic ? `About ${topic}` : "Explanation",
    answer: topic
      ? `I can structure an explanation of **${topic}** from information already in the conversation or text you provide. For current outside facts, use a connected model or a research tool; the instant local engine will not invent live information.`
      : "Send the topic or paste the text you want explained.",
    suggestions: ["Explain it more simply", "Give me an example", "Turn this into notes"],
  };
}

function generalResponse(text: string): LocalAskAIResult {
  const keywords = extractKeywords(text);
  const focus = keywords.slice(0, 3).join(", ") || "your request";
  return {
    intent: "general",
    title: "Instant local answer",
    answer: `I understand that this is about **${focus}**, but the instant local engine does not have enough information to give you a trustworthy open-ended answer. Add details, attach a file, ask me to rewrite or plan something, or switch the composer to **Smart local** so the browser can run the private WebGPU model.`,
    suggestions: ["Make a step-by-step plan", "Attach a file", "Use Smart local"],
  };
}

function missingText(action: string): LocalAskAIResult {
  return {
    intent: action === "rewrite" ? "rewrite" : "summarize",
    title: "Paste the text",
    answer: `Add the text after “${action}:” and I’ll process it on this device.`,
    suggestions: [`${capitalize(action)}: paste text here`, "Create a caption", "Brainstorm ideas"],
  };
}

function extractPayload(prompt: string): string {
  const colon = prompt.indexOf(":");
  if (colon >= 0) return prompt.slice(colon + 1).trim();
  return prompt
    .replace(/^(rewrite|rephrase|improve|fix grammar|make this sound|summarize|summary|shorten|tldr|tl;dr|create|generate|give me|brainstorm|ideas? for|hashtags? for|caption for|plan for|make a plan for)\s+/i, "")
    .trim();
}

function extractKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  text.toLowerCase().match(/[a-z0-9]{3,}/g)?.forEach((word) => {
    if (STOP_WORDS.has(word)) return;
    counts.set(word, (counts.get(word) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([word]) => word)
    .slice(0, 8);
}

function trimWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= max ? words.join(" ") : `${words.slice(0, max).join(" ")}…`;
}

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function lowerFirst(text: string): string {
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text;
}

function toHashtagWord(word: string): string {
  return word.replace(/[^a-z0-9]/gi, "").replace(/^./, (character) => character.toUpperCase());
}
