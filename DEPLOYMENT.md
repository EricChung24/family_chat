# Vercel + Supabase deployment

This repository is a React 19 + TypeScript Vite SPA. It does not use URL-based client routing, so Vercel rewrites are not required for the current tab-based navigation.

## Vercel project settings

- Framework Preset: **Vite**
- Root Directory: **`.`** (repository root)
- Build Command: **`npm run build`**
- Output Directory: **`dist`**
- Install Command: **`npm install`** (default)

## Environment variables

Add these in Vercel for Preview and Production:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Copy both values from Supabase **Project Settings → API**. The publishable key (also called the anon key in older projects) is safe for the browser when Row Level Security is enabled. Never put a `service_role`, secret, database password, or JWT secret in a `VITE_` variable.

Run `supabase/schema.sql` in the Supabase SQL Editor before using persisted family data. `.env`, `.env.local`, `.env.production`, and `.env.*.local` are ignored by Git; never commit real values.
