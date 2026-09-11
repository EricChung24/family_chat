# Family Forum MVP Design

## Original Ask

The owner asked why development had not started. The complete product specification already exists in the root AgentFlow notebook: build a responsive family forum using React, Supabase, and Vercel, with authentication, family membership, forum posts and comments, itineraries, albums, profile settings, and strict family-level data isolation.

## Normal journey

1. A new user registers with email and a family invite code, or signs in to an existing account.
2. The user lands on a family home view that summarizes recent conversation, the next trip, and recent photos without inventing activity.
3. The user opens Discussions, creates a thread, reads its posts, and adds a comment.
4. The user opens Trips, creates or opens an itinerary, groups items by Day 1...N, and adds, edits, reorders, or deletes an item.
5. The user opens Albums, creates an album, uploads a photo, views the responsive photo grid, and opens a photo detail.
6. The user edits display name and avatar, then signs out.
7. Every database and storage operation is restricted to the authenticated user's `family_id`.

## Design decisions

- Color palette: warm paper `#F4F0E8`, ink `#1E2924`, forest `#285C4D`, moss `#6F876D`, terracotta `#C76D4C`, line `#D7D0C3`, white `#FFFEFA`. All UI colors derive from these tokens.
- Typography: local font stack led by `Aptos`, `Segoe UI`, and sans-serif fallbacks; expressive editorial headings use `Georgia`. No external font dependency.
- Spacing system: 4px base with 8, 12, 16, 24, 32, 48, and 64px steps.
- Border-radius strategy: 18px for primary surfaces, 12px for controls, and fully rounded chips only for compact metadata.
- Shadow hierarchy: one soft ambient elevation for floating navigation and dialogs; content separation otherwise uses borders and background contrast.
- Motion style: 160–220ms ease-out transitions for hover, focus, route entry, dialogs, and optimistic actions; reduced-motion disables nonessential movement.
- Layout: desktop uses a 248px navigation rail and bounded content canvas; mobile uses a compact top bar and 64px bottom navigation. Touch targets are at least 44px.
- Visual language: a calm shared household journal, using generous whitespace, fine rules, editorial type contrast, and real content placeholders. No gradients, emoji decoration, or fabricated metrics.

## Product architecture

- React 18 + Vite + TypeScript.
- React Router for `/login`, `/register`, `/`, `/threads`, `/threads/:id`, `/itineraries`, `/itineraries/:id`, `/albums`, `/albums/:id`, and `/profile`.
- Supabase Auth for email/password sessions.
- Supabase PostgreSQL tables: `families`, `profiles`, `threads`, `posts`, `itineraries`, `itinerary_items`, `albums`, and `photos`.
- Supabase Storage bucket `family-photos`, storing objects below `<family_id>/<album_id>/...`.
- Client data access is isolated behind typed repository modules. No service-role key enters the browser or Vercel environment.
- Demo-safe fallback: when Supabase public environment variables are absent, the UI loads a clearly labelled local preview dataset so visual and interaction verification can run without pretending persistence exists.

## Security contract

- RLS is enabled on every public table.
- Select, insert, update, and delete policies resolve membership through the authenticated user's `profiles.family_id`.
- Child records inherit family scope through their parent relation; clients cannot select arbitrary cross-family parents.
- Family bootstrap uses a security-definer RPC with validated invite codes rather than unrestricted client writes to `families` or `profiles`.
- Storage policies validate the first path segment against the user's family id and validate album ownership.
- User content is rendered as text; no raw HTML injection.

## MVP boundary

Included: authentication screens, app shell, responsive navigation, dashboard, discussion list/detail/create/comment flows, itinerary list/detail/day-item CRUD and reorder controls, album list/detail/upload presentation, profile editing, empty/loading/error states, SQL schema/RLS/storage policies, environment template, tests, and deployment documentation.

Deferred: realtime updates, emoji reactions, push notifications, maps, shared forum-itinerary linking, advanced photo editing, moderation workflows, and offline support.

## Necessary concepts and smaller alternatives

- `family_id` tenancy is necessary to satisfy the owner's privacy requirement. Rejected smaller alternative: a single shared dataset, because it leaks data across families.
- A bootstrap RPC is necessary to join users by invite code without exposing privileged writes. Rejected smaller alternative: direct client inserts, because the client could select an arbitrary family.
- Typed repository modules are necessary to keep preview data and Supabase operations behind one observable boundary. Rejected smaller alternative: Supabase calls inside every component, because it makes error states and policy verification inconsistent.
- A preview-data mode is necessary to render and test the application before owner Supabase credentials exist. Rejected smaller alternative: blocking the entire UI on missing external credentials, because it prevents the requested local implementation and review.

## Acceptance

- `npm run build`, unit tests, lint, and type checks pass.
- Core routes render with no console errors at 390px, 768px, and 1440px.
- Keyboard navigation, visible focus, semantic landmarks, dialog focus handling, loading, empty, and error states are present.
- A browser journey proves sign-in preview, forum comment creation, itinerary item creation/reorder, album navigation, profile update, and sign-out.
- SQL documents all tables, foreign keys, indexes, RLS policies, bootstrap RPC, and storage policies.

## Plan commit gate

Source implementation starts only after this design and tracker are committed and the owner supplies the exact AgentFlow Design Go for that commit.
