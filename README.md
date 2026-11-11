<div align="center">

<img src="./public/og-image.png" alt="Event Wishlists Preview" width="760" />

# Event Wishlists

**Personal gift wishlists by event — built with React, TypeScript, Vite & Supabase.**

![React](https://img.shields.io/badge/React-19-149eca?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20RLS-3ecf8e?style=flat-square&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel%20%2F%20CF%20Pages-000000?style=flat-square&logo=vercel&logoColor=white)

</div>

---

## Routes

| Route | Access | Purpose | Highlights |
| :--- | :--- | :--- | :--- |
| `/` | Public | Neutral landing | Hides active events; discreet link to `/admin` |
| `/l/:slug` | Public | Shareable wishlist | Budget cap, countdown, price sort/filter, Quick Look, store tags |
| `/admin` | Owner only | Private studio | Magic Link auth, event & item CRUD, manual reorder, QR SVG export |

> **Intentional scope:** no gift reservations, no store URL scraping, and no visitor accounts.

---

## Architecture

```mermaid
flowchart LR
  Visitor["Visitor (/l/:slug)"] -->|Public SELECT| DB[("Supabase Postgres + RLS")]
  Bot["Social Crawler (WhatsApp / X)"] -->|User-Agent rewrite| OG["/api/list-meta"]
  OG -->|Fetch title & budget| DB
  Owner["Owner (/admin)"] -->|Magic Link Auth| Auth["Supabase Auth"]
  Owner -->|INSERT / UPDATE / DELETE| DB
```

---

## Stack

| Layer | Choice | Why |
| :--- | :--- | :--- |
| **UI** | React 19 + native CSS | Apple-inspired translucent UI, light/dark mode, zero heavy UI libs |
| **Routing** | `react-router-dom` v7 | Clean SPA routes with Vercel & Cloudflare fallbacks |
| **Backend** | Supabase (`@supabase/supabase-js`) | Postgres + Email Magic Link + Row Level Security (`auth.uid() = user_id`) |
| **QR & Previews** | `qrcode-generator` + `/api/list-meta` | Client-side SVG QR codes & dynamic Open Graph cards on share |

---

## Quick Start

### 1. Supabase Setup

1. Create a project in [Supabase](https://supabase.com/).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in **SQL Editor**.
3. Enable **Email** (Magic Link) in **Authentication → Providers**.
4. Add `http://localhost:5173/admin` (and your production `/admin` URL) under **Authentication → URL Configuration → Redirect URLs**.

### 2. Environment Variables

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

> Use only the public `anon` / `publishable` key (`VITE_*` variables are bundled for the browser).

### 3. Run Locally

```bash
npm install
npm start
```

| Command | Action |
| :--- | :--- |
| `npm start` | Start Vite dev server |
| `npm test` | Run unit tests (`src/lib/format.test.ts`) |
| `npm run build` | Type-check (`tsc --noEmit`) and build `dist/` |

---

## Deployment

| Platform | Config | Behavior |
| :--- | :--- | :--- |
| **Vercel** | [`vercel.json`](vercel.json) + [`api/list-meta.js`](api/list-meta.js) | SPA fallback + dynamic Open Graph metadata for `/l/:slug` |
| **Cloudflare Pages** | [`public/_redirects`](public/_redirects) | SPA fallback (`/* /index.html 200`) |
