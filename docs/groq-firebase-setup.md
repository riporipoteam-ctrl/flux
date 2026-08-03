# AskAI Groq setup on Firebase

AskAI uses a Firebase HTTPS Function so the Groq credential never enters the GitHub Pages JavaScript bundle.

## 1. Revoke exposed credentials

Any Groq key pasted into a chat, issue, screenshot, log or public file must be revoked in the Groq Console before continuing. Create a fresh key only after the old key is disabled.

## 2. Install function dependencies

```bash
cd functions
npm install
cd ..
```

## 3. Store the fresh key in Firebase Secret Manager

```bash
firebase use flux-544a6
firebase functions:secrets:set GROQ_API_KEY
```

Paste the newly created key only into the Firebase CLI prompt. Do not put it in `.env`, GitHub Actions variables prefixed with `NEXT_PUBLIC_`, source code or Firebase Hosting files.

## 4. Deploy the authenticated proxy

```bash
firebase deploy --only functions:askaiGroq
```

The default client endpoint is:

```text
https://europe-west1-flux-544a6.cloudfunctions.net/askaiGroq
```

To use a different deployed function URL, set this public non-secret build variable:

```text
NEXT_PUBLIC_ASKAI_GROQ_ENDPOINT=https://your-function-url
```

## Models

- AskAI 1.0 Instant: `openai/gpt-oss-20b`, low reasoning effort.
- AskAI 1.0 Pro: `openai/gpt-oss-120b`, high reasoning effort.
- Pro may enable Groq browser search and Python code execution.

The function verifies the caller's Firebase ID token and rate-limits requests per Firebase UID.
