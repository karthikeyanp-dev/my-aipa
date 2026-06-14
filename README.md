# My AIPA — AI-Organized Personal Notes (PWA)

Write anything. Ask anything. A mobile-first, installable PWA where you capture
one-line notes with zero friction, Gemini organizes them (category + tags +
embedding) in the background, and a RAG chatbot answers questions **only from
your own notes**, with tappable sources.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4, installable PWA (`vite-plugin-pwa`) |
| Auth | Firebase Authentication (Google Sign-In) |
| Database | Cloud Firestore with offline persistence + **native vector search** |
| Backend | Cloud Functions for Firebase (2nd gen, Node 22) |
| LLM | **`gemini-flash-latest`** (alias → Google's newest stable Flash model) |
| Embeddings | **`gemini-embedding-001`** (768-dim, `RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` task types) |

## App structure

- **Home tab** — reverse-chronological notes, category chips (derived live from
  your notes), client-side search, pending notes show an "Organizing…" badge.
- **Ask tab** — RAG chat. Question → embedded → Firestore `findNearest` (cosine,
  top 6) → Gemini answers with `[1]`-style citations + source note cards.
- **Settings tab** — profile, light/dark/auto theme, install-app prompt, JSON
  export, sign out.
- **FAB (+)** — full-screen Notion-style editor. Pressing back with unsaved
  text opens a Save / Discard / Keep editing sheet (browser back button included).

Notes are saved instantly with `status: "pending"` (works fully offline — the
write queues and syncs later). The `processNote` function then classifies the
note against your **existing category list** (the anti-sprawl trick), generates
2–4 tags, embeds the text, and flips status to `processed`. Your original text
is never modified.

## Setup

### 1. Firebase project

1. Create a project at <https://console.firebase.google.com> and upgrade to the
   **Blaze** plan (required for Functions + vector search; free-tier allowances
   still apply — set a budget alert).
2. **Authentication** → Sign-in method → enable **Google**.
3. **Firestore Database** → Create database (production mode).
4. Project settings → Your apps → **Add a Web app** → copy the config.

### 2. Local config

```bash
cp .env.example .env        # paste the web app config values
# put your project id in .firebaserc (replace YOUR_FIREBASE_PROJECT_ID)
npm install
npm run dev                 # http://localhost:5173
```

### 3. Backend (Gemini key, functions, rules, vector index)

```bash
npm install -g firebase-tools
firebase login

cd functions && npm install && cd ..

# Gemini API key from https://aistudio.google.com/apikey
firebase functions:secrets:set GEMINI_API_KEY

# Rules + vector index (firestore.indexes.json contains the 768-dim index)
firebase deploy --only firestore

# Functions
firebase deploy --only functions
```

If your CLI version doesn't deploy the vector index from `firestore.indexes.json`,
create it with gcloud instead:

```bash
gcloud firestore indexes composite create \
  --project=YOUR_FIREBASE_PROJECT_ID \
  --collection-group=notes \
  --query-scope=COLLECTION \
  --field-config field-path=embedding,vector-config='{"dimension":"768","flat":{}}'
```

### 4. Deploy the app

```bash
firebase deploy --only hosting
```

Open the hosted URL on your phone → browser menu → **Add to Home screen** (or
use the Install button in Settings). The app runs standalone, offline-capable.

## Key implementation notes

- **Embedding model consistency** — each note stores `embeddingModel`. If you
  switch models, re-embed everything (set all notes back to `status: "pending"`).
- **Security rules** — clients can only write `text`/`status` on their own
  notes; AI metadata fields are writable only by the Admin SDK (Functions).
- **Hallucination guard** — the chat system prompt forbids answering outside
  the retrieved notes and mandates "I couldn't find a note about this."
- **Loop guard** — `processNote` only acts on `status: "pending"`; its own
  update re-triggers the function but immediately no-ops.

## Continuous deployment (GitHub Actions)

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the app
and runs `firebase deploy --only hosting,functions,firestore`. Manual runs are
also available under the **Actions** tab (**Deploy to Firebase** → Run workflow).

### One-time setup

**1. Create a service account for CI**

Google Cloud Console → IAM & Admin → Service Accounts → Create:

- Name: `github-actions-deploy`
- Grant these roles:
  - **Firebase Admin** (hosting + firestore rules/indexes)
  - **Cloud Functions Admin** (2nd-gen functions)
  - **Cloud Run Admin** + **Artifact Registry Writer** (function runtime images)
  - **Service Account User** (act as the function runtime SA)
  - **Secret Manager Secret Accessor** (read `GEMINI_API_KEY` during deploy)

Then create a **JSON key** for that service account and download it.

**2. Make sure the Gemini secret exists in Firebase**

```bash
firebase functions:secrets:set GEMINI_API_KEY   # one-time; CI reuses it
```

**3. Add repository secrets** (GitHub repo → Settings → Secrets and variables →
Actions → New repository secret):

| Secret name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_MYAIPA2026` | The entire JSON key from step 1 (paste as-is) |
| `VITE_FIREBASE_API_KEY` | From Firebase Console → Project settings → Your apps |
| `VITE_FIREBASE_AUTH_DOMAIN` | " |
| `VITE_FIREBASE_PROJECT_ID` | " |
| `VITE_FIREBASE_STORAGE_BUCKET` | " |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
| `VITE_FIREBASE_APP_ID` | " |

> The `VITE_FIREBASE_*` values are the public web-app config — they ship inside
> the client bundle anyway, so they are not server secrets. They are stored as
> repo secrets only to avoid hard-coding them in the repo.

**4. Push to `main`** — the workflow runs and the site goes live at
`https://<project-id>.web.app`.

> If you rename the Firebase project, update the `FIREBASE_SERVICE_ACCOUNT_*`
> secret name in `.github/workflows/deploy.yml` (the suffix must be the
> **uppercase** project id) and the `default` project in `.firebaserc`.

## Roadmap ideas

Voice capture, Android quick-tile widget, hybrid (vector + keyword) retrieval,
category merge tool, note reminders.
