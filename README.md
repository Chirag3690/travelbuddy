# Vinle (Travelbuddy)

Find travel buddies, squads, and co-travelers for events and trips.

## Local development

```bash
# Backend
cd backend
cp .env.example .env   # set MONGO_URL, DB_NAME
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
cp .env.example .env   # set EXPO_PUBLIC_BACKEND_URL to your Mac LAN IP
yarn install
npx expo start -c
```

## Production (App Store + Google Play)

**Stack:** MongoDB Atlas (free) + **Railway Hobby** ($5/mo) + Expo EAS

**Full guide:** **[docs/DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)**

Quick start after backend is live:

```bash
cd frontend
yarn install
npx eas login
npx eas init
npx eas secret:create --scope project --name EXPO_PUBLIC_BACKEND_URL --value https://YOUR_RAILWAY_URL
yarn build:preview:android   # test first
yarn build:prod:all          # store builds
```
