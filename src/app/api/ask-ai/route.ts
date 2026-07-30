import type { NextRequest } from "next/server";
import { groupPath } from "@/lib/routes";
import { StreamThinkingFilter, stripThinkingText } from "@/lib/ai/strip-thinking";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChatMsg = {
  role: "user" | "assistant" | "system";
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;
};

function extractGroupName(message: string): {
  name: string;
  description: string;
} {
  const named =
    message.match(/group (?:called|named)\s+[“"']?([^"'\n.!?]+)[”"']?/i) ||
    message.match(
      /(?:create|make|start)\s+(?:a\s+)?group\s+(?:for\s+)?[“"']?([^"'\n.!?]+)[”"']?/i
    );
  const name = (named?.[1] || "Flux Crew").trim().slice(0, 48);
  return {
    name,
    description: `Created with AskAI: ${message.slice(0, 200)}`,
  };
}

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        // Keep Firebase/Firestore out of the build-time route evaluation. Netlify
        // collects API route data without a browser Firebase configuration, so
        // load the Flux tools only when a request actually reaches this handler.
        const {
          aiCreateGroup,
          detectIntents,
          generateImage,
          getFluxContext,
          lookupProfile,
          webSearch,
        } = await import("@/lib/ai/tools");

        const body = await req.json();
        const message = String(body.message || "").trim();
        const history: Array<{ role: string; content: string }> = Array.isArray(
          body.history
        )
          ? body.history
          : [];
        const imageBase64 = body.imageBase64 as string | undefined;
        const imageMime = (body.imageMime as string) || "image/jpeg";
        const uid = body.uid as string | undefined;
        const userGroupImage = body.groupAvatarUrl as string | undefined;
        const userGroupBanner = body.groupBannerUrl as string | undefined;

        if (!message && !imageBase64) {
          send({ type: "error", error: "Message required" });
          controller.close();
          return;
        }

        const apiKey = process.env.GROQ_API_KEY;
        const model = process.env.GROQ_MODEL || "qwen/qwen3.6-27b";

        if (!apiKey) {
          send({ type: "error", error: "AskAI is not configured yet." });
          controller.close();
          return;
        }

        send({ type: "status", status: "thinking", label: "Thinking…" });

        const intents = detectIntents(message || "describe image");
        let toolContext = "";
        let generatedImageUrl: string | null = null;
        let groupId: string | null = null;

        send({
          type: "status",
          status: "loading_flux",
          label: "Reading Flux…",
        });
        const flux = await getFluxContext(uid);
        toolContext += `\n\n[Flux current user]\n${flux.me || "Guest"}`;
        toolContext += `\n\n[Recent posts on Flux]\n${flux.postsText || "No posts"}`;
        toolContext += `\n\n[Groups on Flux]\n${flux.groups}`;
        toolContext += `\n\n[Profiles sample]\n${flux.profiles}`;

        const mentions = (message.match(/@[\w]+/g) || []).slice(0, 3);
        for (const m of mentions) {
          send({
            type: "status",
            status: "profile",
            label: `Looking up ${m}…`,
          });
          toolContext += `\n\n[Profile ${m}]\n${await lookupProfile(m)}`;
        }
        if (intents.needsProfile && !mentions.length) {
          const nameMatch = message.match(/profile of\s+@?([\w]+)/i);
          if (nameMatch) {
            toolContext += `\n\n[Profile]\n${await lookupProfile(nameMatch[1])}`;
          }
        }

        if (intents.needsWeb) {
          send({
            type: "status",
            status: "searching",
            label: "Searching the web…",
          });
          const searchQ = message.replace(
            /^(search|look up|google)\s+/i,
            ""
          );
          const results = await webSearch(searchQ);
          toolContext += `\n\n[Web search results]\n${results}`;
          send({
            type: "tool",
            tool: "web_search",
            preview: results.slice(0, 400),
          });
        }

        if (intents.needsImage) {
          send({
            type: "status",
            status: "generating_image",
            label: "Generating image…",
          });
          const imgPrompt =
            message
              .replace(
                /^(generate|draw|create|make)\s+(an?\s+)?(image|picture|photo|logo|banner|art)\s*(of|for)?\s*/i,
                ""
              )
              .trim() || message;
          generatedImageUrl = await generateImage(
            `${imgPrompt}, high quality, detailed, social media aesthetic`
          );
          toolContext += `\n\n[Generated image URL for user]\n${generatedImageUrl}\nInclude this markdown image in your reply: ![generated](${generatedImageUrl})`;
          send({ type: "image", url: generatedImageUrl });
        }

        if (intents.needsGroup && uid) {
          send({
            type: "status",
            status: "creating_group",
            label: "Setting up your group…",
          });
          const { name, description } = extractGroupName(message);
          let avatar = userGroupImage || null;
          let banner = userGroupBanner || null;
          if (!avatar && /generate|ai art|create image/i.test(message)) {
            avatar = await generateImage(
              `cute app icon logo for social group named ${name}, flat vector`
            );
          }
          if (!banner) {
            banner = await generateImage(
              `wide banner header for community group ${name}, aesthetic, no text`
            );
          }
          const result = await aiCreateGroup({
            uid,
            name,
            description,
            isPrivate: /private/i.test(message),
            avatarUrl: avatar,
            bannerUrl: banner,
          });
          if (result.ok) {
            groupId = result.groupId;
            toolContext += `\n\n[Group created]\nName: ${name}\nID: ${groupId}\nLink path: ${groupPath(groupId)}`;
            send({
              type: "group",
              groupId,
              name,
              avatarUrl: avatar,
              bannerUrl: banner,
            });
          } else {
            toolContext += `\n\n[Group creation failed]\n${result.error}`;
            send({ type: "tool", tool: "create_group", preview: result.error });
          }
        }

        send({ type: "status", status: "reasoning", label: "Reasoning…" });

        const system = `You are AskAI, the AI assistant built into Flux by Ripo Team.
You are helpful, truthful, witty, and maximally useful.

CRITICAL OUTPUT RULES:
- Reply ONLY with the final answer the user should read.
- NEVER output thinking, chain-of-thought, analysis process, or hidden reasoning.
- NEVER use tags like <think>, </think>, <thinking>, <thought>, or "Thinking Process:".
- NEVER start with "Thinking…" or describe your internal steps.
- Never mention third-party model vendors or model names (do not say Groq, Qwen, OpenAI, Grok, Gemini, Claude, etc.).
- If asked what you are, say: "I'm AskAI by Ripo Team."

You have live context about Flux posts, profiles, and groups — use it when relevant.
You may receive web search results — use them and cite briefly.
If an image was generated, include the markdown image in your reply.
If a group was created, tell the user the name and path /group?groupId={id}.
You can analyze user-uploaded images when provided.
Keep answers clear. Use short paragraphs and bullets when helpful.
Do not invent Flux usernames or post contents not in context.
If the user asks to create more than one AI group, explain the 1-group limit.`;

        const messages: ChatMsg[] = [
          { role: "system", content: system + toolContext },
        ];

        for (const h of history.slice(-12)) {
          if (h.role === "user" || h.role === "assistant") {
            messages.push({
              role: h.role,
              content: String(h.content || "").slice(0, 4000),
            });
          }
        }

        if (imageBase64) {
          messages.push({
            role: "user",
            content: [
              {
                type: "text",
                text:
                  message ||
                  "Describe this image and help me with it on Flux.",
              },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:${imageMime};base64,${imageBase64}`,
                },
              },
            ],
          });
        } else {
          messages.push({ role: "user", content: message });
        }

        send({ type: "status", status: "answering", label: "Writing…" });

        const aiRes = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages,
              temperature: 0.6,
              max_completion_tokens: 2048,
              top_p: 0.95,
              stream: true,
            }),
          }
        );

        if (!aiRes.ok) {
          const errText = await aiRes.text();
          console.error("AskAI provider error", errText);
          if (imageBase64) {
            send({
              type: "status",
              status: "retry",
              label: "Retrying…",
            });
            const retry = await fetch(
              "https://api.groq.com/openai/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model,
                  messages: [
                    { role: "system", content: system + toolContext },
                    ...history.slice(-12).map((h) => ({
                      role: h.role,
                      content: h.content,
                    })),
                    {
                      role: "user",
                      content: `${message}\n\n[User attached an image; continue text-only.]`,
                    },
                  ],
                  temperature: 0.6,
                  max_completion_tokens: 2048,
                  stream: true,
                }),
              }
            );
            if (!retry.ok) {
              send({
                type: "error",
                error: "AskAI is temporarily unavailable. Try again.",
              });
              controller.close();
              return;
            }
            await streamProvider(retry, send);
          } else {
            send({
              type: "error",
              error: "AskAI is temporarily unavailable. Try again.",
            });
            controller.close();
            return;
          }
        } else {
          await streamProvider(aiRes, send);
        }

        send({
          type: "done",
          generatedImageUrl,
          groupId,
        });
        controller.close();
      } catch (e) {
        console.error(e);
        send({
          type: "error",
          error: e instanceof Error ? e.message : "AskAI failed",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function streamProvider(
  res: Response,
  send: (obj: Record<string, unknown>) => void
) {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  let firstToken = true;
  const thinkFilter = new StreamThinkingFilter();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        // Ignore provider reasoning channels entirely (never show to user)
        void json.choices?.[0]?.delta?.reasoning;
        void json.choices?.[0]?.delta?.reasoning_content;

        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          const cleaned = thinkFilter.push(delta);
          if (cleaned) {
            if (firstToken) {
              send({ type: "status_clear" });
              firstToken = false;
            }
            send({ type: "token", content: cleaned });
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  const tail = thinkFilter.flush();
  if (tail) {
    if (firstToken) send({ type: "status_clear" });
    send({ type: "token", content: stripThinkingText(tail) });
  }
  send({ type: "status_clear" });
}
