* _2026-09-13 14:03:08 (gpt-5.6-terra/high)_

Evidence: Storage RLS requires folder 1 to equal `my_family_id()`. Avatar upload now fetches `profile.family_id`, writes `${profileFamilyId}/${userId}/avatar-…`, and stops with a notification plus busy-state reset when the profile is missing or the lookup fails. `npm.cmd test` passed 3/3.

Added `family_id` in the avatar-display query is unused; its test assertion targets that unused query, while the upload’s own lookup is not directly asserted. The path assertion does detect restoration of the original user-ID-first-folder regression.

Outcome: PASS
Minimality: BLOCKING
Conformance: PASS
Self-check: Reviewed only the specified commit and inputs, ran the focused npm test script, and made no changes.
