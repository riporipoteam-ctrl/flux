# Flux — Premium Social Network

Next.js 15 · TypeScript · Tailwind CSS v4 · Firebase (Auth, Firestore, Storage) · Framer Motion

## Location

```
C:\Users\ripot\Desktop\Flux social media network
```

## Features (shipped)

### Core
- Email/password + Google auth, multi-step onboarding
- Home feed (For You + Following)
- **Click any post** → `/post/[id]` with full **comments/replies** thread
- Post creation (text, media, polls), like, repost, reply, bookmark, share
- Profile pages + Edit profile (avatar, banner, bio, socials)
- Settings with **dark mode toggle** (light is default)

### Platform
- **Explore** — search posts, people, groups + trending hashtags
- **Notifications** center (realtime-ready list, mark read)
- **Messages** — 1:1 DMs with live Firestore subscription
- **Groups** — create/join, feed, members, custom ranks (owner)
- **Events** — create/join, discussion posts
- **Shop** — Flux Coins, catalog, gifts, daily challenges
- **AskAI** — feed-aware assistant (`/api/ask-ai`; add `XAI_API_KEY` for Grok)
- **Admin** — verify badges, reports, coin tools (claim first admin if none)

### Data
- Full Firestore schema + security rules in `firestore.rules` / `docs/SCHEMA.md`

## Run locally

```bash
cd "C:\Users\ripot\Desktop\Flux social media network"
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Firebase console checklist

1. **Authentication** → enable Email/Password and Google  
2. **Firestore** → create database; paste/deploy `firestore.rules`  
3. **Storage** → enable; paste/deploy `storage.rules`  
4. **Authentication → Settings → Authorized domains** → include `localhost`  
5. Deploy indexes from `firestore.indexes.json` (or click index links in browser console when prompted)

```bash
npm i -g firebase-tools
firebase login
firebase use flux-544a6
firebase deploy --only firestore:rules,storage,firestore:indexes
```

## Env

Copy `.env.example` → `.env.local` (already filled for your project).

## Next waves

Say **next** for Groups, Chats/Calls, Shop, Admin, AskAI, etc.
