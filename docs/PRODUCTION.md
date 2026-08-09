# Vinle — Production launch (App Store + Google Play)

This guide takes Vinle from local dev to store-ready builds using **Expo EAS** for mobile and a **hosted HTTPS API** for the backend.

## Before you start (accounts & assets)

| Requirement | Cost | Link |
|-------------|------|------|
| Apple Developer Program | $99/year | [developer.apple.com](https://developer.apple.com/programs/) |
| Google Play Console | $25 one-time | [play.google.com/console](https://play.google.com/console) |
| Expo account | Free tier OK | [expo.dev](https://expo.dev) |
| MongoDB Atlas | Free tier OK | [mongodb.com/atlas](https://www.mongodb.com/atlas) |
| Backend host | **Railway Hobby** | **$5/mo** | [railway.app](https://railway.app) |

You also need:

- **Privacy policy URL** (required by both stores)
- **Support email** (e.g. `support@yourdomain.com`)
- **App Store screenshots** (6.7", 6.5", iPad if supporting tablet)
- **Play Store screenshots** (phone + feature graphic 1024×500)

---

## Phase 1 — Production backend (HTTPS)

The mobile app **cannot** use your Mac’s LAN IP (`10.x.x.x:8000`) in production.

### 1. MongoDB Atlas

1. Create a cluster → Database Access user → Network Access (`0.0.0.0/0` for cloud hosts).
2. Copy connection string into `MONGO_URL`.

### 2. Deploy API on Railway Hobby

1. Sign up at [railway.app](https://railway.app) → deploy `backend/` from GitHub (see `docs/DEPLOYMENT_GUIDE.md` §4).
2. Start on **Trial** ($5 credit) to test; **upgrade to Hobby ($5/mo)** before App Store / Play launch.
3. Set variables: `MONGO_URL`, `DB_NAME=vinle_prod`, `ALLOWED_ORIGINS=*`
4. Generate public HTTPS domain → save as `PROD_API_URL`

4. Smoke test:

```bash
curl https://YOUR_API_URL/api/
```

### 3. Auth redirect (Google login)

Login uses Emergent OAuth with redirect `vinle://auth`.

- Ensure **`vinle://auth`** is registered as an allowed redirect in your Emergent / Google OAuth settings for **production** builds.
- Test on a **preview build** before store submission.

---

## Phase 2 — EAS mobile builds

All commands run from `frontend/`.

### 1. Install & login

```bash
cd frontend
yarn install
npx eas login
```

### 2. Link Expo project

```bash
npx eas init
```

This sets `EAS_PROJECT_ID` in your Expo project. Update `app.config.ts` `owner` if you use an Expo org.

### 3. Set production API URL (secret)

```bash
npx eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value https://YOUR_API_URL
```

EAS injects this at build time into the app bundle.

### 4. Configure store credentials in `eas.json`

Edit `frontend/eas.json` → `submit.production`:

- **iOS:** `appleId`, `ascAppId`, `appleTeamId`
- **Android:** path to Google Play service account JSON

### 5. Internal test builds first

```bash
yarn build:preview:ios
yarn build:preview:android
```

Install on devices via Expo dashboard links. Verify:

- [ ] Login (Google)
- [ ] Discover / swipe / stamps
- [ ] Matches & chat
- [ ] Squads
- [ ] Hide from discover toggle
- [ ] No “cannot reach backend” errors

### 6. Production store builds

```bash
yarn build:prod:all
```

Or separately:

```bash
yarn build:prod:ios
yarn build:prod:android
```

---

## Phase 3 — App Store (iOS)

### 1. App Store Connect

1. [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → New App
2. Bundle ID: **`com.vinle.app`** (must match `app.config.ts`)
3. SKU: e.g. `vinle-ios-001`
4. Category: **Travel** or **Social Networking**

### 2. Listing copy (starter)

- **Name:** Vinle
- **Subtitle:** Find your travel buddy
- **Description:** Match with people heading to the same festival, city, or trail. Swipe boarding-pass cards, join squads, and plan trips together.
- **Keywords:** travel, buddy, festival, trip, squad, co-traveler
- **Privacy policy URL:** *(required)*

### 3. Submit build

After `build:prod:ios` completes:

```bash
yarn submit:ios
```

Or upload manually in Transporter / App Store Connect.

### 4. App Review notes

```
Test account: Use "Continue with Google" — reviewer signs in with their Google account.
Backend: https://YOUR_API_URL
Deep link scheme: vinle://
```

Apple often rejects apps that only work on local network — confirm production API is live.

---

## Phase 4 — Google Play (Android)

### 1. Play Console setup

1. Create app → **Vinle** → default language
2. Package name: **`com.vinle.app`**
3. Complete **Data safety** form (account info, photos, location if collected)
4. **Content rating** questionnaire

### 2. Service account (for EAS Submit)

1. Play Console → Setup → API access → Link Google Cloud project
2. Create service account with **Release manager** role
3. Download JSON → save as `frontend/google-play-service-account.json` (**do not commit**)
4. Add to `.gitignore`

### 3. Submit

```bash
yarn submit:android
```

Start with **`track: internal`** in `eas.json`, then promote to **closed testing → open testing → production**.

---

## Phase 5 — Post-launch checklist

- [ ] Monitor API errors / MongoDB connections
- [ ] Set up uptime check on `/api/`
- [ ] Rotate secrets; never commit `.env` or Play service account JSON
- [ ] Plan OTA updates: `eas update` for JS-only fixes (optional)
- [ ] Version bumps: update `version` in `app.config.ts`; EAS `autoIncrement` handles build numbers

---

## Quick reference

| Task | Command |
|------|---------|
| Preview iOS | `yarn build:preview:ios` |
| Preview Android | `yarn build:preview:android` |
| Store build (both) | `yarn build:prod:all` |
| Submit iOS | `yarn submit:ios` |
| Submit Android | `yarn submit:android` |
| Set API URL secret | `eas secret:create --name EXPO_PUBLIC_BACKEND_URL --value https://...` |

---

## Common blockers

| Issue | Fix |
|-------|-----|
| “Cannot reach backend” on device | Use HTTPS production URL in EAS secret, not LAN IP |
| Google login fails on build | Register `vinle://auth` redirect for production |
| iOS ATS blocks API | API must be HTTPS; remove local-network exceptions (production profile does this) |
| Play rejects cleartext | Production build sets `usesCleartextTraffic: false` |
| Bundle ID mismatch | Keep `com.vinle.app` in sync across App Store Connect, Play Console, and `app.config.ts` |

---

## What we added in the repo

- `frontend/app.config.ts` — store IDs, production vs dev network settings
- `frontend/eas.json` — build & submit profiles
- `frontend/.env.example` — local dev template
- `backend/.env.example` + `backend/Dockerfile` — API deployment
- `frontend/.easignore` — lean upload to EAS

**You** still need to: deploy the API, create store listings, run EAS builds logged into your accounts, and pass store review.
