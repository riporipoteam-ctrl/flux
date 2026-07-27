# Flux Firestore Schema

Production data model for Firebase (Auth + Firestore + Storage).

## Collections

| Collection | Purpose |
|---|---|
| `users/{uid}` | Profiles, settings, coins, stats |
| `usernames/{username}` | Unique username claims → `{ uid }` |
| `posts/{postId}` | Posts, replies, quotes, reposts |
| `posts/{id}/likes\|reposts\|bookmarks\|pollVotes` | Engagement |
| `users/{uid}/following\|followers` | Graph |
| `notifications/{id}` | Activity center |
| `hashtags/{tag}` | Tag index / trending |
| `reports`, `blocks`, `mutes` | Safety |
| `lists/{id}/members` | Custom lists |
| `groups/{id}/members\|ranks` | Communities |
| `conversations/{id}/messages` | Chats |
| `calls/{id}` | Voice/video metadata |
| `events/{id}/attendees` | Events |
| `shopItems`, `purchases`, `gifts`, `coinTransactions` | Economy |
| `dailyChallenges`, `userChallenges` | Daily rewards |
| `aiConversations/{id}/messages` | AskAI |
| `activity/{uid}/events` | History |
| `adminLogs` | Moderation audit |

Deploy rules:

```bash
firebase deploy --only firestore:rules,storage,firestore:indexes
```

See `src/types/index.ts` for TypeScript shapes and `firestore.rules` for access control.
