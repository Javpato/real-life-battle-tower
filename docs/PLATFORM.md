# Platform and sync status

Cloud sync is unavailable until a Supabase project is configured. The app must keep the local save and say so. No existing local save is uploaded or merged automatically. The current server schema implements pairing, memberships, lease fencing, purchases/upgrades, step accounting and versioned nutrition writes. Full server-authoritative combat/quest replay is **not implemented**: do not present a local RPG save as a fully synchronized adventure.

## Supabase setup

Enable anonymous sign-ins; apply `supabase/migrations` in order. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from `.env.example`. Never expose a service-role key. Deploy over HTTPS. No production Supabase credentials were supplied and migrations have not been verified against a live project.

Each installation has its own anonymous auth identity. Pairing adds membership, never shares refresh tokens. The owner authorizes a code shown by the second device. **All linked devices receive both adventure and nutrition access**, as explicitly requested. Display this before authorization. Codes expire after five minutes, are stored as hashes, and are consumed once. Failed approval attempts are limited and commit their counters.

All table writes are denied to clients. Nonprivileged RPC wrappers call narrowly scoped private functions with identity checks. Economy operations lock the save row, verify the active lease, check prices server-side, and record operation IDs and request bodies. Reuse the same operation ID when retrying. Do not expose arbitrary XP/badge/coin grants. Purchases and steps share the same transactional wallet. The SQL starter prices must remain aligned with the eventual cloud game configuration; local economy is independent until combat sync is implemented.

Acquire control, retain returned epoch, renew every 20 seconds; lease lasts 90 seconds. Mark `busy` before an exercise and `safe` after its acknowledged completion. Transfer only when safe. An expired controller is fenced out. Nutrition writes do not require the adventure lease. Revisions require expected version; `VERSION_CONFLICT` must display a user resolution flow, never overwrite the local entry silently.

## Steps

Android Health Connect is preferred; the step counter is a fallback, never an additive second source. First create a server step epoch, then establish the native baseline at its `startedAt`. Only that source/installation may credit the epoch. Send cumulative steps for the epoch; retries and decreasing totals grant no extra coins. Before changing source or difficulty, sync the old epoch, close it by starting another, and establish a new baseline. Historical steps before enrollment are not credited. Fractional reward blocks in a closed epoch are currently retained in the ledger but are **not carried to a later epoch**; source/difficulty switching may lose a partial block. Another device cannot replace an active source in this initial API.

Sensor counts are hardware readings since boot. Reboot or loss of baseline requires a new epoch, not subtraction against an old baseline. The server checks monotonicity and plausible elapsed-time bounds; this is duplication protection, not cryptographic proof against a modified app. No browser step simulation exists.

## Android build and validation

Use Java 21 and Android SDK 36. `npm run build`, `npx cap sync android`, then `cd android && ./gradlew assembleDebug`. Install `android/app/build/outputs/apk/debug/app-debug.apk`. The native plugin requires runtime activity permission and separate Health Connect permissions. Real camera, physical steps, permission revocation, Health Connect import and reboot behavior require physical-device tests; synthetic tests cannot verify them.

Health import does not upload to Supabase on its own. The caller must preview the import and ask the user to save it into the diary. Missing metrics return null. Food logs and health imports must preserve source and time-range metadata. No nutrition AI is included.

## Verified in this environment

- TypeScript compile of the adapters and Capacitor config passed.
- Four Vitest tests pass: web never advertises measured steps, web rejects step/health reads, unconfigured cloud never creates fake remote progress.
- `supabase/tests/platform.mjs` runs both SQL migrations inside PGlite PostgreSQL and checks RLS isolation, explicit linked diary access, pairing reuse, transactional prices/idempotency, null/stale nutrition versions, owner-only export, generation fencing after complete diary deletion, control transfer/fencing, monotonic step credit and revocation. Test crypto stand-ins are fixtures only; the deployed migration requires pgcrypto.
- To run SQL verification: install `@electric-sql/pglite` as a development dependency, then `node supabase/tests/platform.mjs`; or set `PGLITE_MODULE` to an existing installation's `dist/index.js`.
- Hosted Supabase authentication/Realtime integration and true concurrent sessions remain unverified without a project. No physical-device readings have been tested.

The owner may revoke a linked installation, export nutrition with revision history, or erase nutrition data. Erasure increments `nutrition_generation`; callers must use the generation from `listSaves()` for new writes. Old queued writes are rejected with `NUTRITION_RESET`. A revoked installation's offline cache cannot be erased remotely until it reconnects; clear that cache when authorization fails. Full exported diary JSON may contain private health information.
