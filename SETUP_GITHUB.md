# Next steps — GitHub + Firebase deployment setup

This is a checklist to complete when you're ready. The repo is already
git-initialized and committed (branch `main`). All CI files are in place.
You just need to: create the GitHub repo, create a service account, and add
secrets.

---

## 1. Create the GitHub repo and push

You're logged in to the `gh` CLI as `karthikeyanp-dev`.

```powershell
# Public repo (change to --private if you prefer)
gh repo create my-aipa --public --source=. --remote=origin --push
```

This one command creates the repo, sets the remote, and pushes `main`.

> The first deploy will FAIL until the secrets (step 4) are added — expected.

---

## 2. Create a service account for CI (Google Cloud Console)

**Google Cloud Console → IAM & Admin → Service Accounts → Create service account**

- Name: `github-actions-deploy`
- Grant these roles:
  - **Firebase Admin** — hosting + firestore rules/indexes
  - **Cloud Functions Admin** — 2nd-gen functions
  - **Cloud Run Admin** — function runtime
  - **Artifact Registry Writer** — function images
  - **Service Account User** — act as the function runtime SA
  - **Secret Manager Secret Accessor** — read `GEMINI_API_KEY` during deploy
- Finish, then open the service account → **Keys → Add Key → Create new key
  → JSON**. A `.json` file downloads — keep it safe; you'll paste it as a
  secret. Treat it like a password (do NOT commit it; `.gitignore` already
  blocks `service-account*.json` / `firebase-service-account*.json`).

---

## 3. Make sure the Gemini secret exists in Firebase (one-time)

CI does **not** receive the `GEMINI_API_KEY` value. It binds the existing
secret from Secret Manager at deploy time, so set it once locally:

```powershell
firebase functions:secrets:set GEMINI_API_KEY
```

---

## 4. Add repository secrets to GitHub

**Repo → Settings → Secrets and variables → Actions → New repository secret.**

Add these 7 secrets:

| Secret name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_MYAIPA2026` | Entire JSON key from step 2 (paste the file contents) |
| `VITE_FIREBASE_API_KEY` | Firebase Console → Project settings → Your apps → Web app config |
| `VITE_FIREBASE_AUTH_DOMAIN` | " |
| `VITE_FIREBASE_PROJECT_ID` | " |
| `VITE_FIREBASE_STORAGE_BUCKET` | " |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
| `VITE_FIREBASE_APP_ID` | " |

> The `VITE_FIREBASE_*` values are the **public** web-app config (they ship
> inside the client bundle anyway). They're stored as repo secrets only to
> avoid hard-coding them in the repo.

### Faster: use the `gh` CLI instead of the web UI

```powershell
# Paste the service-account JSON file contents
gh secret set FIREBASE_SERVICE_ACCOUNT_MYAIPA2026 < path\to\service-account.json

# Each of the following will prompt you to paste the value (hidden input)
gh secret set VITE_FIREBASE_API_KEY
gh secret set VITE_FIREBASE_AUTH_DOMAIN
gh secret set VITE_FIREBASE_PROJECT_ID
gh secret set VITE_FIREBASE_STORAGE_BUCKET
gh secret set VITE_FIREBASE_MESSAGING_SENDER_ID
gh secret set VITE_FIREBASE_APP_ID
```

---

## 5. Trigger the first deploy

Once all secrets are set, either:

```powershell
# Option A — empty commit to re-trigger the workflow
git commit --allow-empty -m "ci: trigger deploy"
git push
```

```powershell
# Option B — run it manually from the Actions tab
# GitHub repo → Actions → "Deploy to Firebase" → Run workflow
```

Watch the run under **Actions → Deploy to Firebase**. On success the app is
live at `https://myaipa2026.web.app`.

---

## How it works after setup

- Every push to `main` builds the app and runs
  `firebase deploy --only hosting,functions,firestore`.
- `GEMINI_API_KEY` is reused from Secret Manager (never in CI).
- Two concurrent deploys to the same branch are serialized automatically.
- Deploys to production are immediate — keep `main` green. Branch + PR for
  experiments.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Permission denied` on deploy | The service account is missing a role — re-check step 2. Most common miss: **Service Account User** or **Artifact Registry Writer**. |
| `GEMINI_API_KEY ... not found` | Step 3 wasn't run, or the name differs. It must be exactly `GEMINI_API_KEY`. |
| Hosting deployed but functions missing | Check the **Cloud Functions Admin** + **Cloud Run Admin** roles; also confirm the project is on the **Blaze** plan. |
| Blank page after deploy | `VITE_FIREBASE_*` secrets were missing/empty during the build → the bundle has no config. Re-check step 4, then redeploy. |
| Renaming the Firebase project | Update the `FIREBASE_SERVICE_ACCOUNT_*` secret name in `.github/workflows/deploy.yml` (suffix = **uppercase** project id) and the `default` project in `.firebaserc`. |
