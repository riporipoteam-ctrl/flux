import { collection, getDocs, limit, orderBy, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getUser, getUserByUsername, updateUserProfile } from "@/services/users";
import { createGroup } from "@/services/groups";
import { stripUndefined } from "@/lib/firestore-safe";

export async function webSearch(q: string): Promise<string> {
  const queryText = q.trim().slice(0, 200);
  if (!queryText) return "No query provided.";

  try {
    // DuckDuckGo Instant Answer API (no key)
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(queryText)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "FluxAskAI/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) throw new Error("search failed");
    const data = await res.json();

    const parts: string[] = [];
    if (data.AbstractText) {
      parts.push(`Summary: ${data.AbstractText}`);
      if (data.AbstractURL) parts.push(`Source: ${data.AbstractURL}`);
    }
    if (data.Answer) parts.push(`Answer: ${data.Answer}`);
    const related = (data.RelatedTopics || [])
      .slice(0, 6)
      .map((t: { Text?: string; FirstURL?: string }) =>
        t.Text ? `- ${t.Text}${t.FirstURL ? ` (${t.FirstURL})` : ""}` : null
      )
      .filter(Boolean);
    if (related.length) {
      parts.push("Related:\n" + related.join("\n"));
    }

    if (!parts.length) {
      // Fallback: Wikipedia opensearch
      const wiki = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(queryText)}&limit=5&namespace=0&format=json`,
        { headers: { "User-Agent": "FluxAskAI/1.0" } }
      );
      if (wiki.ok) {
        const w = await wiki.json();
        const titles: string[] = w[1] || [];
        const descs: string[] = w[2] || [];
        const links: string[] = w[3] || [];
        if (titles.length) {
          parts.push(
            "Web results (Wikipedia):\n" +
              titles
                .map((t, i) => `${i + 1}. ${t} — ${descs[i] || ""} ${links[i] || ""}`)
                .join("\n")
          );
        }
      }
    }

    return parts.length
      ? parts.join("\n\n")
      : `No strong web results for "${queryText}". Answer from general knowledge and note uncertainty.`;
  } catch (e) {
    console.error("webSearch", e);
    return `Web search unavailable. Answer from general knowledge for: ${queryText}`;
  }
}

export async function generateImage(prompt: string): Promise<string> {
  const p = prompt.trim().slice(0, 400);
  // Pollinations — free image generation, no API key
  const seed = Math.floor(Math.random() * 1e9);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;
}

export async function getFluxContext(uid?: string) {
  const [postsSnap, groupsSnap, usersSnap] = await Promise.all([
    getDocs(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20))
    ).catch(() => null),
    getDocs(query(collection(db, "groups"), limit(15))).catch(() => null),
    getDocs(
      query(
        collection(db, "users"),
        where("onboardingComplete", "==", true),
        limit(15)
      )
    ).catch(() => null),
  ]);

  const posts =
    postsSnap?.docs
      .map((d) => {
        const x = d.data();
        if (x.isDeleted || x.isDraft) return null;
        return {
          id: d.id,
          text: String(x.text || "").slice(0, 220),
          authorId: x.authorId,
          likes: x.likesCount || 0,
          type: x.type || "post",
        };
      })
      .filter(Boolean) || [];

  // resolve a few usernames
  const authorIds = [...new Set(posts.map((p) => p!.authorId))].slice(0, 12);
  const authors = await Promise.all(authorIds.map((id) => getUser(id)));
  const authorMap = new Map(authors.filter(Boolean).map((a) => [a!.uid, a!]));

  const postsText = posts
    .slice(0, 15)
    .map((p, i) => {
      const a = authorMap.get(p!.authorId);
      return `${i + 1}. [@${a?.username || "user"}] (${p!.likes} likes) ${p!.text}`;
    })
    .join("\n");

  const groups =
    groupsSnap?.docs
      .map((d) => {
        const g = d.data();
        return `- ${g.name} (${g.memberCount || 0} members, ${g.isPrivate ? "private" : "public"}): ${String(g.description || "").slice(0, 100)} [id:${d.id}]`;
      })
      .join("\n") || "None";

  const profiles =
    usersSnap?.docs
      .map((d) => {
        const u = d.data();
        return `- @${u.username} — ${u.displayName} | bio: ${String(u.bio || "").slice(0, 80)} | followers: ${u.followersCount || 0}`;
      })
      .join("\n") || "None";

  let me = "";
  if (uid) {
    const u = await getUser(uid);
    if (u) {
      me = `Current user: @${u.username} (${u.displayName}), coins: ${u.coins}, posts: ${u.postsCount}`;
    }
  }

  return { postsText, groups, profiles, me };
}

export async function lookupProfile(usernameOrUid: string) {
  const u =
    (await getUserByUsername(usernameOrUid.replace(/^@/, ""))) ||
    (await getUser(usernameOrUid));
  if (!u) return "Profile not found.";
  return JSON.stringify(
    {
      username: u.username,
      displayName: u.displayName,
      bio: u.bio,
      followers: u.followersCount,
      following: u.followingCount,
      posts: u.postsCount,
      verified: u.isVerified,
      mood: u.mood,
      location: u.location,
    },
    null,
    2
  );
}

export async function aiCreateGroup(params: {
  uid: string;
  name: string;
  description: string;
  isPrivate?: boolean;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
}): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const user = await getUser(params.uid);
  if (!user) return { ok: false, error: "User not found" };

  // Rate limit: AI may create only 1 group ever
  const userSnap = await getDoc(doc(db, "users", params.uid));
  const aiGroupsCreated = userSnap.data()?.aiGroupsCreated ?? 0;
  if (aiGroupsCreated >= 1) {
    return {
      ok: false,
      error: "You already used your free AI group creation (limit 1). Create more groups manually.",
    };
  }

  try {
    const groupId = await createGroup({
      ownerId: params.uid,
      name: params.name.slice(0, 60),
      description: params.description.slice(0, 400),
      isPrivate: !!params.isPrivate,
      avatarUrl: params.avatarUrl || null,
    });

    if (params.bannerUrl) {
      const { updateGroup } = await import("@/services/groups");
      await updateGroup(groupId, params.uid, { bannerUrl: params.bannerUrl });
    }

    await updateUserProfile(params.uid, {});
    // direct field for counter
    const { updateDoc, serverTimestamp, increment } = await import(
      "firebase/firestore"
    );
    await updateDoc(
      doc(db, "users", params.uid),
      stripUndefined({
        aiGroupsCreated: increment(1),
        updatedAt: serverTimestamp(),
      })
    );

    return { ok: true, groupId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create group",
    };
  }
}

export function detectIntents(message: string) {
  const m = message.toLowerCase();
  return {
    needsWeb:
      /\b(search|google|look up|latest|news|who is|what is|when did|weather|price of|current)\b/i.test(
        m
      ) || m.includes("online") || m.includes("web"),
    needsImage:
      /\b(generate|draw|create|make).{0,40}(image|picture|photo|logo|banner|art|illustration)\b/i.test(
        m
      ) ||
      /\b(image of|picture of|logo for|banner for)\b/i.test(m),
    needsGroup:
      /\b(create|make|start).{0,30}group\b/i.test(m) ||
      /\bgroup (called|named|for)\b/i.test(m),
    needsProfile: /@[\w]+/.test(message) || /\bprofile of\b/i.test(m),
  };
}
