# Vinle — Complete deployment guide (copy-paste)

**Stack:** MongoDB Atlas (free) + **Railway Hobby** ($5/mo API) + Expo EAS (mobile builds)

**Monthly infra cost (typical):** ~**$5 Railway Hobby** + **$0 MongoDB M0** = **~$5/mo** (+ Apple $99/yr, Play $25 once for stores)

**Bundle ID (both stores):** `com.vinle.app`  
**Deep link (auth):** `vinle://auth`

---

## Table of contents

1. [Prerequisites & accounts](#1-prerequisites--accounts)
2. [Push code to GitHub](#2-push-code-to-github)
3. [MongoDB Atlas (database)](#3-mongodb-atlas-database)
4. [Railway Hobby (production API)](#4-railway-hobby-production-api)
5. [Verify API works](#5-verify-api-works)
6. [Privacy policy (required by stores)](#6-privacy-policy-required-by-stores)
7. [Expo EAS (mobile builds)](#7-expo-eas-mobile-builds)
8. [Test on your phone (preview builds)](#8-test-on-your-phone-preview-builds)
9. [Google Play Store](#9-google-play-store)
10. [Apple App Store](#10-apple-app-store)
11. [Submit & go live](#11-submit--go-live)
12. [All environment variables](#12-all-environment-variables)
13. [All commands cheat sheet](#13-all-commands-cheat-sheet)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites & accounts

Create these accounts **before** deploying:

| # | Service | URL | Cost |
|---|---------|-----|------|
| 1 | GitHub | https://github.com | Free |
| 2 | MongoDB Atlas | https://www.mongodb.com/cloud/atlas/register | Free tier |
| 3 | **Railway Hobby** | https://railway.app | **$5/mo** (includes $5 usage) |
| 4 | Expo | https://expo.dev/signup | Free tier OK |
| 5 | Google Play Console | https://play.google.com/console | $25 one-time |
| 6 | Apple Developer | https://developer.apple.com/programs/ | $99/year |

On your Mac, install (if missing):

```bash
# Node + Yarn (frontend)
node -v    # should be 18+
yarn -v

# Python (backend local testing)
python3 --version

# Docker (optional, for local API test)
docker --version

# EAS CLI (installed via yarn in frontend/)
```

---

## 2. Push code to GitHub

Railway deploys from GitHub. From your project root:

```bash
cd /Users/chiragbansal/Projects/travelbuddy

# If not already a remote repo:
git remote -v

# Create repo on GitHub (website): name it travelbuddy or vinle
# Then:
git add backend/ frontend/ docs/ README.md
git commit -m "Prepare Vinle for production deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/travelbuddy.git
git push -u origin main
```

**Do not commit:**

- `frontend/.env` (LAN IP)
- `backend/.env` (Mongo credentials)
- `frontend/google-play-service-account.json`

These are already in `.gitignore`.

---

## 3. MongoDB Atlas (database)

### 3.1 Create cluster

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. **Build a Database** → **M0 FREE** → pick region **Mumbai (ap-south-1)** or closest to you
3. Cluster name: `vinle-prod` → Create

### 3.2 Database user

1. **Database Access** → **Add New Database User**
2. Authentication: Password
3. Username: `vinle_app`
4. Password: generate strong password → **save in password manager**
5. Privileges: **Read and write to any database**
6. Add User

### 3.3 Network access

1. **Network Access** → **Add IP Address**
2. Choose **Allow Access from Anywhere** (`0.0.0.0/0`)  
   (Required because Railway uses dynamic IPs)
3. Confirm

### 3.4 Connection string

1. **Database** → **Connect** → **Drivers** → Python → copy URI
2. Looks like:

```
mongodb+srv://vinle_app:<password>@vinle-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

3. Replace `<password>` with your real password (URL-encode special chars: `@` → `%40`, etc.)

**Save as `MONGO_URL`** — you’ll paste this into Railway.

---

## 4. Railway Hobby (production API)

We use **Railway Hobby** — **$5/month**, includes **$5 of resource usage**. For Vinle’s small FastAPI app, that’s usually enough (always-on, WebSockets, HTTPS).

### 4.0 Railway plans (what to pick)

| Phase | Plan | Cost | When |
|-------|------|------|------|
| First deploy & test | **Trial** | $0 — **$5 credit**, 30 days | Sign up, deploy, test with EAS preview |
| Store launch + live users | **Hobby** | **$5/mo** | Before trial ends or when going live |

**Do not stay on Free ($1/mo credit)** — not enough for a 24/7 API.

**Upgrade to Hobby:**
1. Railway dashboard → click your **profile / workspace**
2. **Settings** → **Billing** → **Upgrade to Hobby**
3. Add payment method → confirm **$5/month**

### 4.1 New project

1. [railway.app](https://railway.app) → sign up (GitHub login)
2. **New Project** → **Deploy from GitHub repo** → authorize GitHub → select `travelbuddy`
3. Open the service → **Settings**:
   - **Root Directory:** `backend`
   - **Builder:** Dockerfile (uses `backend/Dockerfile`)

Or: **Empty Project** → **New** → **GitHub Repo** → set root to `backend`.

### 4.2 Environment variables

Railway → your service → **Variables** tab → **RAW Editor** → paste:

```env
MONGO_URL=mongodb+srv://vinle_app:YOUR_PASSWORD@vinle-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
DB_NAME=vinle_prod
ALLOWED_ORIGINS=*
```

Click **Deploy** (or push to GitHub to auto-deploy).

### 4.3 Public URL (HTTPS)

1. Service → **Settings** → **Networking** → **Generate Domain**
2. You get something like:

```
https://travelbuddy-production-a1b2.up.railway.app
```

3. **Save this URL** as `PROD_API_URL` — used in EAS and the mobile app.

Health check: `https://PROD_API_URL/api/` → `{"message":"Vinle API"}`

### 4.4 Keep costs on Hobby (~$5/mo)

Vinle’s backend is lightweight. On Hobby you typically stay within the included $5 if you:

- Run **one service** (the API) — no extra workers unless needed
- Use **MongoDB Atlas** for the database (not Railway Postgres)
- Avoid large egress (normal app traffic is fine)

Optional: Railway → service → **Settings** → set a **usage limit** / alerts if available in your workspace.

### 4.5 Files already in repo

**`backend/Dockerfile`** — builds the API container  
**`backend/railway.toml`** — health check on `/api/`

You don’t need to edit these unless you change ports or paths.

---

## 5. Verify API works

Replace `PROD_API_URL` with your Railway domain:

```bash
# Health
curl https://PROD_API_URL/api/

# Expected: {"message":"Vinle API"}

# Docs (open in browser)
open https://PROD_API_URL/docs
```

If this fails:

- Railway → **Deployments** → click latest → read **Build Logs** / **Deploy Logs**
- Common fix: wrong `MONGO_URL` password or Atlas network not open

---

## 6. Privacy policy (required by stores)

1. Copy `docs/privacy-policy-template.md`
2. Fill in `[YOUR_EMAIL]`, `[DATE]`, host name
3. Publish at a **public URL**, e.g.:
   - Notion → Share → Publish to web
   - GitHub Pages
   - Google Doc → Anyone with link

**Save URL as `PRIVACY_POLICY_URL`** — needed for App Store + Play Console.

Example support email: `support@yourdomain.com` or your Gmail for now.

---

## 7. Expo EAS (mobile builds)

All commands from **`frontend/`** directory.

### 7.1 Install dependencies

```bash
cd /Users/chiragbansal/Projects/travelbuddy/frontend
yarn install
```

### 7.2 Login & link project

```bash
npx eas login
npx eas init
```

- Choose **Create a new project** or link existing
- Note the **project ID** (written to Expo dashboard)

### 7.3 Set production backend URL (critical)

Replace with your Railway URL (**https**, no trailing slash):

```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value https://PROD_API_URL
```

Verify:

```bash
npx eas secret:list
```

### 7.4 Configure Apple credentials (first iOS build)

EAS will prompt interactively, or run:

```bash
npx eas credentials
```

Select **iOS** → **production** → let EAS manage certificates (recommended).

### 7.5 Configure Android keystore (first Android build)

```bash
npx eas credentials
```

Select **Android** → **production** → **Generate new keystore** (EAS stores it).

### 7.6 Edit submit config (before store upload)

Open `frontend/eas.json` and replace placeholders:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "you@email.com",
      "ascAppId": "1234567890",
      "appleTeamId": "ABCDE12345"
    },
    "android": {
      "serviceAccountKeyPath": "./google-play-service-account.json",
      "track": "internal"
    }
  }
}
```

- **appleId:** Apple ID email
- **ascAppId:** App Store Connect → App → General → Apple ID (numeric)
- **appleTeamId:** [developer.apple.com/account](https://developer.apple.com/account) → Membership → Team ID

---

## 8. Test on your phone (preview builds)

**Always do this before store submission.**

```bash
cd frontend

# Android APK/AAB for internal install
yarn build:preview:android

# iOS for TestFlight-style internal install
yarn build:preview:ios
```

When done (~10–20 min):

1. [expo.dev](https://expo.dev) → Projects → **vinle** → **Builds**
2. Open build → **Install** (Android) or follow QR (iOS)

### Test checklist

- [ ] Open app → not stuck on errors
- [ ] **Continue with Google** → lands back in app (`vinle://auth`)
- [ ] Complete / view profile
- [ ] Discover loads profiles (not “Cannot reach backend”)
- [ ] Swipe / stamp / plane animation
- [ ] Buddies + Chats
- [ ] Squads
- [ ] Profile → **Hide from discover** toggle saves

### If login fails on device

Login code (`frontend/app/login.tsx`) uses:

```
https://auth.emergentagent.com/?redirect=vinle://auth
```

Contact Emergent / your OAuth provider to ensure **`vinle://auth`** is an allowed redirect for production mobile builds.

---

## 9. Google Play Store

### 9.1 Create app

1. [Play Console](https://play.google.com/console) → **Create app**
2. Name: **Vinle**
3. Default language: English
4. App or game: **App**
5. Free / Paid: **Free**
6. Declarations → Create

### 9.2 Store listing

**Main store listing →**

| Field | Value |
|-------|--------|
| App name | Vinle |
| Short description | Find travel buddies for festivals, trips & trails. |
| Full description | See below |
| App icon | 512×512 PNG (use `frontend/assets/images/icon.png` exported) |
| Feature graphic | 1024×500 PNG (teal + logo + tagline) |
| Phone screenshots | 2–8 from real device (Discover, stamp, Buddies) |

**Full description (copy-paste):**

```
Vinle helps you find travel co-conspirators — people heading to the same festival, city, or trail.

• Swipe boarding-pass cards to find buddies
• Match when you’re both in
• Join or create travel squads
• Chat and plan together
• Hide your profile after your trip is done

Perfect for concerts, treks, city breaks, and open travel plans.
```

**Privacy policy URL:** `PRIVACY_POLICY_URL`

### 9.3 App content forms

Complete every section in **Policy → App content**:

| Section | What to declare |
|---------|-----------------|
| Privacy policy | Your public URL |
| Ads | No ads (unless you add them) |
| Content rating | Fill questionnaire (likely Everyone / Teen) |
| Target audience | 18+ recommended (dating-adjacent social) |
| Data safety | Email, name, photos, location, messages — collected for app functionality |
| News app | No |

### 9.4 Production build

```bash
cd frontend
yarn build:prod:android
```

Download **`.aab`** from Expo builds page if not using auto-submit.

### 9.5 Google Play service account (for `eas submit`)

1. Play Console → **Setup** → **API access**
2. Link Google Cloud project
3. **Create service account** → Grant **Release manager** in Play Console users
4. Download JSON key → save as:

```
frontend/google-play-service-account.json
```

(Never commit — already gitignored)

### 9.6 Upload release

**Option A — EAS Submit:**

```bash
yarn submit:android
```

**Option B — Manual:**

Play Console → **Testing → Internal testing** → **Create release** → upload `.aab`

Add yourself as internal tester → open test link on Android phone.

---

## 10. Apple App Store

### 10.1 Register bundle ID

1. [developer.apple.com/account](https://developer.apple.com/account) → **Identifiers**
2. **+** → **App IDs** → **App**
3. Description: Vinle
4. Bundle ID: **Explicit** → `com.vinle.app`
5. Capabilities: none required for MVP
6. Register

### 10.2 App Store Connect app

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+** → **New App**
2. Platform: iOS
3. Name: **Vinle**
4. Primary language: English
5. Bundle ID: `com.vinle.app`
6. SKU: `vinle-ios-001`
7. User access: Full access

### 10.3 App Information

| Field | Value |
|-------|--------|
| Subtitle | Find your travel buddy |
| Category | Primary: **Travel**, Secondary: **Social Networking** |
| Privacy Policy URL | `PRIVACY_POLICY_URL` |
| Age Rating | 17+ (user-generated content / social) — complete questionnaire |

### 10.4 Version 1.0.0 listing

**Description:**

```
Find people heading to the same place, gig, or trail — and plan it together.

Vinle is for wanderers: swipe boarding-pass style cards, match with fellow travelers, join squads, and chat in-app. When your trip is done, hide your profile from discover with one toggle.

• Discover by Live Events, Trips, or Open plans
• Rubber-stamp swipe — cleared or no-go
• Squads for group travel
• Real-time chat with matches
```

**Keywords:** travel,buddy,festival,trip,squad,co-traveler,backpacking,events

**Support URL:** your site or `mailto:support@yourdomain.com`

**Screenshots:** 6.7" iPhone (1290×2796) — required; capture Discover, Profile, Buddies

### 10.5 Production iOS build

```bash
cd frontend
yarn build:prod:ios
```

### 10.6 Upload to App Store Connect

```bash
yarn submit:ios
```

Or use **Transporter** app with `.ipa` from Expo.

### 10.7 TestFlight

1. App Store Connect → **TestFlight**
2. Wait for build processing (~5–30 min)
3. **Internal testing** → add your Apple ID
4. Install TestFlight app on iPhone → test full flow

### 10.8 App Review information

```
Sign in: Tap "Continue with Google" — reviewer uses any Google account.

Notes:
- Backend: https://PROD_API_URL
- Auth redirect scheme: vinle://auth
- Location/photos used for travel profile only.
```

---

## 11. Submit & go live

### Android path

1. Internal testing OK for 1–2 days
2. Play Console → **Production** → **Create release** → same `.aab`
3. **Review and roll out**

Review: often hours to 3 days.

### iOS path

1. TestFlight OK
2. App Store Connect → **App Store** tab → **Add for Review**
3. Export compliance: **No** encryption beyond HTTPS (already set in `app.config.ts`)
4. Submit

Review: often 1–3 days.

### After approval

- Monitor Railway logs
- Set up free uptime ping: [uptimerobot.com](https://uptimerobot.com) → monitor `https://PROD_API_URL/api/`

---

## 12. All environment variables

### Railway (backend)

```env
MONGO_URL=mongodb+srv://vinle_app:PASSWORD@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=vinle_prod
ALLOWED_ORIGINS=*
```

### EAS secret (frontend build)

```env
EXPO_PUBLIC_BACKEND_URL=https://PROD_API_URL
```

Set via CLI, not committed:

```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value https://PROD_API_URL
```

### Local dev only (`frontend/.env`)

```env
EXPO_PUBLIC_BACKEND_URL=http://YOUR_LAN_IP:8000
```

### Local dev only (`backend/.env`)

```env
MONGO_URL=mongodb+srv://...   # or mongodb://localhost for local
DB_NAME=vinle_dev
```

---

## 13. All commands cheat sheet

```bash
# ─── BACKEND LOCAL ───
cd backend
cp .env.example .env          # edit MONGO_URL, DB_NAME
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# ─── BACKEND DOCKER LOCAL TEST ───
cd backend
docker build -t vinle-api .
docker run -p 8000:8000 -e MONGO_URL="..." -e DB_NAME=vinle_prod vinle-api
curl http://localhost:8000/api/

# ─── FRONTEND LOCAL ───
cd frontend
cp .env.example .env          # LAN IP for phone testing
yarn install
npx expo start -c

# ─── EAS ───
cd frontend
npx eas login
npx eas init
npx eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value https://PROD_API_URL
npx eas secret:list

yarn build:preview:android
yarn build:preview:ios
yarn build:prod:android
yarn build:prod:ios
yarn build:prod:all

yarn submit:android
yarn submit:ios

# ─── VERIFY PRODUCTION API ───
curl https://PROD_API_URL/api/
open https://PROD_API_URL/docs
```

---

## 14. Troubleshooting

| Problem | Cause | Fix |
|---------|--------|-----|
| `Cannot reach backend` on phone build | EAS secret missing or LAN URL | `eas secret:create` with Railway HTTPS URL; rebuild |
| Railway deploy crash | Bad Mongo URL | Check password encoding, Atlas IP whitelist |
| `401` on API calls | Session expired | Log in again (7-day sessions) |
| Google login loop | Redirect not registered | Allow `vinle://auth` with Emergent auth |
| iOS build fails signing | No Apple dev account | Enroll in Apple Developer Program |
| Android upload rejected | Data safety incomplete | Fill all Play Console forms |
| Apple rejection “local network” | App hits LAN IP | Rebuild with production EAS secret |
| Cleartext HTTP blocked Android | Production uses HTTP | Production profile disables cleartext — use HTTPS API only |

---

## Repo files reference

| Path | Purpose |
|------|---------|
| `backend/Dockerfile` | Railway container |
| `backend/railway.toml` | Railway health check |
| `backend/.env.example` | Backend env template |
| `frontend/app.config.ts` | Bundle IDs, permissions, splash |
| `frontend/eas.json` | Build & submit profiles |
| `frontend/.env.example` | Local frontend env |
| `docs/privacy-policy-template.md` | Store-required privacy policy |
| `docs/PRODUCTION.md` | Shorter overview |

---

## Order of work (print this)

```
[ ] 1. GitHub push
[ ] 2. MongoDB Atlas cluster + user + connection string
[ ] 3. Railway deploy backend (Trial OK to start)
[ ] 4. Upgrade to Railway Hobby ($5/mo) before going live
[ ] 5. curl PROD_API_URL/api/ works
[ ] 6. Privacy policy published → PRIVACY_POLICY_URL
[ ] 7. eas login + eas init
[ ] 8. eas secret EXPO_PUBLIC_BACKEND_URL = Railway HTTPS URL
[ ] 9. build:preview android + ios → test on phone
[ ] 10. Google Play app + internal release
[ ] 11. Apple bundle ID + App Store Connect + TestFlight
[ ] 12. build:prod:all
[ ] 13. submit android + ios
[ ] 14. Production rollout after tests pass
```

When you finish **step 4**, share your `PROD_API_URL` (domain only is fine) if you want help verifying the next steps.
