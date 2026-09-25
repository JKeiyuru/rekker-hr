# Rekker HR — Setup Instructions (Windows / PowerShell / VS Code)

This project has two folders you run separately:
- `server/` — the Node.js/Express/MongoDB API
- `client/` — the React (Vite) app

You'll run both at the same time, in two separate PowerShell terminals.

---

## 0. One-time tools you need installed

1. **Node.js** (v18 or newer) — https://nodejs.org (download the LTS installer)
   Check it worked:
   ```powershell
   node -v
   npm -v
   ```
2. **MongoDB** — pick ONE of these:
   - **Option A (easiest): MongoDB Atlas (cloud, free tier)** — create a free cluster at
     https://www.mongodb.com/cloud/atlas and grab your connection string
     (looks like `mongodb+srv://user:password@cluster0.mongodb.net/rekker-hr`).
   - **Option B: MongoDB installed locally** — https://www.mongodb.com/try/download/community
     Once installed, it normally runs automatically as a Windows service on
     `mongodb://127.0.0.1:27017`.
3. **VS Code** — you already have this.

---

## 1. Unzip the project

Unzip `rekker-hr.zip` somewhere convenient, e.g. `C:\Projects\rekker-hr`.
Open that folder in VS Code (`File > Open Folder`).

Open a PowerShell terminal in VS Code: `Terminal > New Terminal`.

---

## 2. Set up the backend (server)

In your VS Code terminal:

```powershell
cd server
npm install
```

Now create your environment file. PowerShell doesn't have `cp`, so run:

```powershell
Copy-Item .env.example .env
```

Open the new `server\.env` file and fill in:
- `MONGO_URI` — your Atlas connection string, OR leave the local default if you
  installed MongoDB locally (`mongodb://127.0.0.1:27017/rekker-hr`)
- `JWT_SECRET` — replace with any long random string (mash your keyboard)

Save the file, then seed the database with a default admin login and a few
sample employees:

```powershell
npm run seed
```

You should see something like:
```
Created admin login:
  email:    admin@rekker.co.ke
  password: Rekker@2026
```
**Write this down / change it after your first login.**

Now start the API server:

```powershell
npm run dev
```

Leave this terminal running. You should see:
`Rekker HR API running in development mode on port 5000`

---

## 3. Set up the frontend (client)

Open a **second** PowerShell terminal (`Terminal > New Terminal` again, or
click the `+` icon), then:

```powershell
cd client
npm install
npm run dev
```

Vite will print a local URL, normally:

```
Local:   http://localhost:5173/
```

---

## 4. Open the app

Go to **http://localhost:5173** in your browser.

Log in with:
- Email: `admin@rekker.co.ke`
- Password: `Rekker@2026`

You should land on the HR dashboard with the sample employees already loaded.

---

## Everyday use after the first setup

Every time you want to work on it again, you just need to start both servers:

**Terminal 1:**
```powershell
cd server
npm run dev
```

**Terminal 2:**
```powershell
cd client
npm run dev
```

(No need to run `npm install` or `npm run seed` again unless you delete
`node_modules` or wipe your database.)

---

## Troubleshooting

- **"npm run dev" fails with a MongoDB connection error** — double check
  `MONGO_URI` in `server\.env`. If you're using Atlas, make sure your current
  IP address is allow-listed under Atlas > Network Access.
- **Port 5000 or 5173 already in use** — close whatever else is using it, or
  change `PORT` in `server\.env` (and update the proxy target in
  `client\vite.config.js` to match).
- **Login works but pages show no data** — that's expected until you add real
  employees; the seed script only adds 3 sample ones to get you started.
- **File uploads (Documents module) don't show images/PDFs after restart** —
  uploaded files are stored in `server\uploads\`. Don't delete that folder.
