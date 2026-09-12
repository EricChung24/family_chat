# Vercel + Supabase deployment

This repository is a React 19 + TypeScript Vite SPA. It does not use URL-based client routing, so Vercel rewrites are not required for the current tab-based navigation.

## Vercel project settings

- Framework Preset: **Vite**
- Root Directory: **`.`** (repository root; in Vercel this may also be left blank)
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

If the build log says `/vercel/path0/package.json` is missing, the Vercel project is pointing at the wrong repository, branch, or Root Directory. This repository's current `origin/master` contains only the notebook files and has no `package.json`; the deployable app is on the `family-forum` branch. Select branch **`family-forum`**, set Root Directory to `.` (or blank), and redeploy. `vercel.json` pins the build, install, and output settings but cannot override an incorrect Vercel Root Directory.
