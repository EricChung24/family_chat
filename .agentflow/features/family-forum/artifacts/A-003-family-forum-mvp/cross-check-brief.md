# Full implementation cross-check brief

- Stage: final cross-check for implementation slice c57bc37630bd3b39f5cb2c22c644d4c6422627d0.
- Exact read inputs: commit c57bc37630bd3b39f5cb2c22c644d4c6422627d0, `.agentflow/features/family-forum/artifacts/A-003-family-forum-mvp/cross-check-facts.json`, `.agentflow/features/family-forum/artifacts/A-003-family-forum-mvp/design.md`, and `.agentflow/features/family-forum/.agentflow/features/family-forum.devlog.md`.
- Output path: `.agentflow-review/cross-check-report.md` only.
- Active mode: full, read-only review. Tier: better. Model: gpt-5.6-terra. Effort: high. Output language: Traditional Chinese.
- Checks: inspect broad UI and Supabase trust boundary, rerun `npm run build` and `npm run lint`, reconstruct the normal user journey, and return exactly one each of Outcome, Minimality, and Conformance as PASS or BLOCKING.
- Report format: first line `* _YYYY-MM-DD HH:MM:SS (gpt-5.6-terra/high)_`; include `Reviewed implementation commit: c57bc37630bd3b39f5cb2c22c644d4c6422627d0`, `Verdict: PASS`, `Outcome: PASS`, `Minimality: PASS`, `Conformance: PASS`; final line must be `Self-check: <non-empty statement>`.
- Forbidden changes: do not modify source, configuration, dependencies, or any path except the declared report; do not invoke AgentFlow or delegate.

Scope discipline ??implement exactly the ask; park everything else as a proposal. The ask's scope is what the user wrote plus tests, commits, the notebook, STATUS, and any records required by the active route. Do not refactor, rename, reformat, add dependencies, or repair adjacent behavior unless the Ask requires it. Pass this paragraph verbatim in every worker brief.
