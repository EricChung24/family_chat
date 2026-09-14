# Family Chat

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=fff)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase&logoColor=111)

Private, responsive family workspace for conversations, memories, albums, trips, and profile identity.

繁體中文文件：[README.zh-TW.md](./README.zh-TW.md)

## Features

- Family authentication and family-scoped access with Supabase RLS.
- Discussion composer with title, rich-text body, images, categories, and hashtags.
- Discussion list with author, reply count, search results, pinned posts, `HOT`, `NEW`, and recommendation badges.
- Article detail pages with edit/delete controls for owners and direct article replies.
- Threaded comments with avatars, reply context, floor numbers, parent-child connection rails, edit/delete actions, and reply notifications.
- Optional neon horizontal danmaku mode that animates reader comments across an article.
- Shared albums with cover thumbnails, photo metadata, lightbox browsing, previous/next controls, and private signed media URLs.
- Family trip itineraries with date ranges.
- Profile display name, avatar, title badge, and visual settings.
- Responsive layouts tuned for desktop and iPhone-sized screens, dark mode, and Flaticon UIcons.

## Architecture

```text
React + TypeScript + Vite
        ├── Supabase Auth      authenticated sessions
        ├── PostgreSQL         families, profiles, threads, posts, albums, photos
        └── Supabase Storage   private family-photos bucket + signed URLs
```

The client is a Vite SPA. Authorization is enforced by Supabase Row Level Security; the browser only uses the anonymous key.

## Data model

- `families` / `profiles`: family membership and display identity.
- `threads`: discussion title, creator, timestamps, pin state, and family scope.
- `posts`: original article and comments/replies; `parent_post_id` represents reply hierarchy.
- `notifications`: reply notifications for family members.
- `albums` / `photos`: shared albums, captions, locations, and Storage paths.
- `itineraries` / `itinerary_items`: family trip planning.

## Getting started

```bash
npm install
npm run dev
```

Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, run [`supabase/schema.sql`](./supabase/schema.sql), then apply migrations in `supabase/migrations/` in order. Create the private `family-photos` Storage bucket and policies described by the schema.

## Quality checks

```bash
npm run typecheck
npm run build
npm test
```

## Deployment

Connect the repository to Vercel, use `master` as the production branch, and configure the two Vite environment variables. See [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Screenshots

- [English demo](./demo-en.png)
- [繁體中文 demo](./demo-zh-TW.png)

## License

MIT — see [LICENSE](./LICENSE).
