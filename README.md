# Merch IQ

Adaptive inventory & sales intelligence for Indian fashion/apparel SMBs — manual stock entry, CSV/multi-platform import (Meesho, Shopify, Amazon, Flipkart), dead-stock recovery, and revenue analytics across sales channels.

**Live app:** https://merch-iq-app.onrender.com
**API:** https://merch-iq-api.onrender.com

## Stack

- **Frontend:** React (Create React App) — `docs/inventory-app`
- **API:** Node/Express + Prisma ORM — `docs/inventory-api`
- **Database:** PostgreSQL
- **Auth:** JWT (localStorage)
- **Deploy:** Render (see `render.yaml` — API, static frontend, and Postgres provisioned together as a Blueprint)

## Features

- Manual product & stock-lot entry with photo capture
- CSV/XLSX import with per-platform column mapping and row-level preview (Meesho, Shopify, Amazon, Flipkart)
- Multi-channel sales tracking and revenue dashboard
- Dead-stock / days-unmoved detection and recovery workflow
- Low-stock alerts, order detail views, hourly Shopify auto-sync

## Local development

### API (`docs/inventory-api`)

```bash
cd docs/inventory-api
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev
npm run dev             # http://localhost:3001
```

### Frontend (`docs/inventory-app`)

```bash
cd docs/inventory-app
cp .env.example .env   # REACT_APP_API_URL=http://localhost:3001
npm install
npm start                # http://localhost:3000
```

## Deployment

Provisioned on Render as a Blueprint (`render.yaml`) — one Postgres instance, one Node web service for the API (`merch-iq-api`), and one static site for the frontend (`merch-iq-app`). Integration credentials (Shopify, Amazon, Flipkart, WhatsApp, S3/R2) are set directly in the Render dashboard and are not committed.

## Project history

This repository was originally pushed to GitHub from a different local folder; it was later moved to its current location on disk. Git history and the `origin` remote (`flutebyte/Merch_iq`) carry over unaffected — only the local path changed.
