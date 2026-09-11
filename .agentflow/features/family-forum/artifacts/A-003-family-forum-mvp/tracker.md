# Tracker

## Identity

- **Work key:** A-003-family-forum-mvp.

- **Active Ask:** A-003.

- **Goal:** Build the specified responsive React, Supabase, and Vercel family-forum MVP.

- **Last update:** 2026-09-12 00:41:00 Asia/Taipei.

- **Evidence commit:** uncommitted.

## Overall state

- **State:** active.

- **Reason:** Design must be frozen before source implementation.

- **Total:** 6.

- **Completed:** 0.

- **Remaining:** 6.

## Accepted task checklist

- [ ] **T-1:** Freeze the smallest complete MVP design from the root specification; scope is design, security contract, normal journey, and acceptance only; proof requires a committed `design.md` and exact Design Go. Source: A-003.

- [ ] **T-2:** Scaffold the Vite React TypeScript application and design system; scope is tooling, app shell, responsive navigation, tokens, and shared states; proof requires typecheck, lint, tests, and responsive render evidence. Source: A-003.

- [ ] **T-3:** Implement authentication, family bootstrap, typed data access, SQL schema, RLS, and storage policies; scope excludes service-role credentials and external account mutation; proof requires focused repository/auth tests and direct SQL inspection. Source: A-003.

- [ ] **T-4:** Implement discussions, itineraries, albums, dashboard, and profile flows; scope is the documented MVP and explicitly excludes deferred v2 features; proof requires component tests and a complete browser journey. Source: A-003.

- [ ] **T-5:** Complete accessibility, loading/empty/error coverage, responsive polish, and Vercel documentation; scope is delivery quality without new product concepts; proof requires the complete relevant suite and viewport/console checks. Source: A-003.

- [ ] **T-6:** Obtain external cross-check, Host gate PASS, exact Result Go, close the stream record, commit, and push; scope is acceptance and delivery records only; proof requires PASS verdicts, clean status, and local/remote equality. Source: A-003.

## Accepted scope changes

- Recover the already-authorized root specification into the stream and begin the consequential MVP workflow. Source: A-003. Effect: replaces the mistaken activation-only interpretation with the documented family-forum implementation scope.

## Current recovery

- **Current item:** T-1.

- **Last proven result:** The root notebook contains the complete family-forum MVP specification and authorizes this `family-forum` stream.

- **Active blocker or running process:** Source work is gated on a committed design and exact Design Go.

- **Next safe action:** Validate and commit this tracker and design, then record the exact Design Go requirement.

- **Expected changed files:** .agentflow/features/family-forum/artifacts/A-003-family-forum-mvp/design.md; .agentflow/features/family-forum/artifacts/A-003-family-forum-mvp/tracker.md; application source and tests after Design Go; Supabase SQL; deployment documentation; stream notebook.

## Completion proof

- **All accepted tasks checked:** no.

- **Blocking accepted decision:** exact Design Go for the plan commit.

- **Operation running:** no.

- **Next action remaining:** T-1.

- **Evidence status:** current.

- **Judgment:** active.

## Update meaning

- Saving this tracker is a recovery checkpoint, not a stop signal.

- Work continues with the next unfinished item unless an independent stop condition applies.
