# Family Chat

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

![English demo](./demo-en.png)

> A private, shared family space for discussions, memories, albums, and trips.

[繁體中文 README](./README.zh-TW.md)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=fff)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=111)
![Vercel](https://img.shields.io/badge/Vercel-deployed-000?logo=vercel&logoColor=fff)

## Overview

Family Chat is a responsive React web app for a small, trusted family group. Members can publish rich-text posts, discuss them, upload album photos with metadata, plan itineraries, and manage their profile identity.

## Features

- **Family discussions** — rich-text posts, formatted previews, author profiles, avatars, titles/badges, post counts, and original-poster labels.
- **Comments and replies** — persistent Supabase-backed post conversations with author identity and rich content.
- **Shared albums** — create, browse, edit, and delete albums; upload photos; view photos in a lightbox; save location and text descriptions; delete photos.
- **Family trips** — create and browse itineraries with start and end dates.
- **Profiles** — edit display name, avatar, title/badge color and size.
- **Responsive UI** — dark glassmorphism styling, mobile navigation, desktop rail controls, and accessible buttons/labels.
- **Secure uploads** — images are stored under the authenticated family scope in Supabase Storage, with client-side type and size checks.

## 🧭 Product areas

| Area             | What members can do                                        |
| ---------------- | ---------------------------------------------------------- |
| 🏠 Home          | See the latest family activity and shared albums           |
| 📈 Discussions   | Publish, edit, delete, and open full article details       |
| 💬 Conversations | Add formatted comments and identify the original poster    |
| 🖼️ Albums        | Upload, preview, describe, locate, edit, and delete photos |
| 🗓️ Trips         | Record family itineraries and date ranges                  |
| 👤 Profile       | Manage name, avatar, title, badge color, and size          |

## 🧱 Architecture

```text
React + TypeScript + Vite
        │
        ├── Supabase Auth ─── authenticated family session
        ├── PostgreSQL ─────── threads, posts, albums, photos, profiles
        └── Storage ────────── family-photos bucket + signed URLs
```

The client is intentionally thin: family membership and authorization are enforced by Supabase RLS, while Vercel serves the compiled SPA and route fallback.

## 🔐 Security model

- Every family-owned table has Row Level Security enabled.
- Reads and writes are scoped to the authenticated member's `family_id`.
- Storage paths begin with the family identifier and use signed URLs for private media.
- The browser only receives the Supabase anonymous key; never expose a service-role key.
- Upload controls validate image MIME type and size before sending files.

## 🗃️ Data model

- `profiles` — display identity, avatar, title/badge styling, and family membership.
- `threads` — discussion title, creator, family scope, and timestamps.
- `posts` — the original article content plus comments/replies; `parent_post_id` supports nested replies.
- `albums` — shared album title and description.
- `photos` — Storage path, caption, location, uploader, and album relation.

## 🧪 Useful scripts

| Command             | Purpose                           |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the local Vite server       |
| `npm run typecheck` | Validate TypeScript               |
| `npm run build`     | Create the production bundle      |
| `npm test`          | Run security and repository tests |

## 🔄 Development workflow

1. Create a focused feature branch from `master`.
2. Update the React UI and keep Supabase changes in a numbered migration.
3. Run `npm run typecheck`, `npm run build`, and `npm test` locally.
4. Review the responsive layout and both language experiences.
5. Commit with a clear message and open a pull request.
6. Merge to `master` only after checks pass; Vercel then creates the production deployment.

Database changes should be backwards-compatible whenever possible. Never commit `.env.local`, service-role keys, or private media.

## 🛠️ Troubleshooting

- **Empty content:** confirm the user is authenticated and has a `profiles.family_id`.
- **RLS errors:** run `supabase/schema.sql` and every migration in order.
- **Upload errors:** confirm the `family-photos` bucket and Storage policies exist.
- **Vercel still shows old UI:** verify the connected repository and production branch match the Git remote; then redeploy.

## 🗺️ Roadmap

- Threaded reply controls and notification badges
- Album drag-and-drop ordering and richer metadata
- Automated preview deployments and end-to-end browser tests

## Technical specifications

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | React 18, TypeScript, Vite                          |
| Styling   | CSS, responsive layouts, glassmorphism theme        |
| Rich text | `react-quill-new` / Quill                           |
| Icons     | Flaticon UIcons Regular Rounded                     |
| Backend   | Supabase Auth, PostgreSQL, Row Level Security       |
| Media     | Supabase Storage (`family-photos`) with signed URLs |
| Hosting   | Vercel SPA deployment                               |
| Quality   | TypeScript build/typecheck and Node security tests  |

## Local development

```bash
npm install
npm run dev
```

Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, run [`supabase/schema.sql`](./supabase/schema.sql), then apply the migrations in `supabase/migrations/` in order.

```bash
npm run typecheck
npm run build
npm test
```

## Demo screenshots

- [English demo](./demo-en.png)
- [繁體中文 demo](./demo-zh-TW.png)

## Deployment

Connect the repository to Vercel, select `master` as the production branch, configure the Vite environment variables, and deploy. See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## License

This project is open source under the [MIT License](./LICENSE). You may use,
modify, and redistribute it subject to the license terms.
