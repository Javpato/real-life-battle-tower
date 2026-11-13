# Platform and sync status

Cloud sync is unavailable until a Supabase project is configured. The app must keep the local save and say so. No existing local save is uploaded or merged automatically. The server implements pairing, memberships, lease fencing, transactional economy, step accounting, versioned nutrition writes, and semantic adventure commands covering combat and quests. The Edge Function uses generated copies of the exact shared TypeScript game engine. Full browser routing to this backend and hosted end-to-end verification are separate integration steps: do not present a local save as synchronized until those are connected and tested.

## Supabase setup

Enable anonymous sign-ins; apply `supabase/migrations` in order. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env.example`. Never expose a service-role key. Deploy over HTTPS. No production Supabase credentials were supplied and migrations have not been verified against a live project.

Each installation has its own anonymous auth identity. Pairing adds membership, never shares refresh tokens. The owner authorizes a code shown by the second device. **All linked devices receive both adventure and nutrition access**, as explicitly requested. Display this before authorization. Codes expire after five minutes, are stored as hashes, and are consumed once. Failed approval attempts are limited and commit their counters.

All table writes are denied to clients. Nonprivileged RPC wrappers call narrowly scoped private functions with identity checks. Economy operations lock the save row, verify the active lease, check prices server-side, and record operation IDs and request bodies. Reuse the same operation ID when retrying. Do not expose arbitrary XP/badge/coin grants. Purchases and steps share the same transactional wallet. The SQL starter prices must remain aligned with the eventual cloud game configuration; local economy is independent until combat sync is implemented.

Acquire control, retain returned epoch, renew every 20 seconds; lease lasts 90 seconds. Mark `busy` before an exercise and `safe` after its acknowledged completion. Transfer only when safe. An expired controller is fenced out. Nutrition writes do not require the adventure lease. Revisions require expected version; `VERSION_CONFLICT` must display a user resolution flow, never overwrite the local entry silently.

## Steps

Android Health Connect is preferred; the step counter is a fallback, never an additive second source. First create a server step epoch, then establish the native baseline at its `startedAt`. Only that source/installation may credit the epoch. Send cumulative steps for the epoch; retries and decreasing totals grant no extra coins. Before changing source or difficulty, sync the old epoch, close it by starting another, and establish a new baseline. Historical steps before enrollment are not credited. Partial reward blocks remain in the server wallet per difficulty, so changing source does not erase them or reprice existing steps. The owner can replace another device’s source; other members cannot take over an active source. Sync the old source first because late claims against a closed epoch are rejected.

Sensor counts are hardware readings since boot. Reboot or loss of baseline requires a new epoch, not subtraction against an old baseline. The server checks monotonicity and plausible elapsed-time bounds; this is duplication protection, not cryptographic proof against a modified app. No browser step simulation exists.

## Android build and validation

Use a full JDK 21 (including javac) and Android SDK 36. The APK requires Android 8/API 26 or newer; Health Connect availability is checked independently. `npm run build`, `npx cap sync android`, then `cd android && ./gradlew assembleDebug`. Install `android/app/build/outputs/apk/debug/app-debug.apk`. The native plugin requires runtime activity permission and separate Health Connect permissions. Real camera, physical steps, permission revocation, Health Connect import and reboot behavior require physical-device tests; synthetic tests cannot verify them.

Health import does not upload to Supabase on its own. The caller must preview the import and ask the user to save it into the diary. Missing metrics return null. Food logs and health imports must preserve source and time-range metadata. No nutrition AI is included.

## Verified in this environment

- TypeScript compile of the adapters and Capacitor config passed.
- Four Vitest tests pass: web never advertises measured steps, web rejects step/health reads, unconfigured cloud never creates fake remote progress.
- `supabase/tests/platform.mjs` runs both SQL migrations inside PGlite PostgreSQL and checks RLS isolation, explicit linked diary access, pairing reuse, transactional prices/idempotency, null/stale nutrition versions, owner-only export, generation fencing after complete diary deletion, control transfer/fencing, monotonic step credit and revocation. Test crypto stand-ins are fixtures only; the deployed migration requires pgcrypto.
- To run SQL verification: install `@electric-sql/pglite` as a development dependency, then `node supabase/tests/platform.mjs`; or set `PGLITE_MODULE` to an existing installation's `dist/index.js`.
- Hosted Supabase authentication/Realtime integration and true concurrent sessions remain unverified without a project. No physical-device readings have been tested.

The owner may revoke a linked installation, export nutrition with revision history, or erase nutrition data. Erasure increments `nutrition_generation`; callers must use the generation from `listSaves()` for new writes. Old queued writes are rejected with `NUTRITION_RESET`. A revoked installation's offline cache cannot be erased remotely until it reconnects; clear that cache when authorization fails. Full exported diary JSON may contain private health information.

Native `compileDebugKotlin` succeeded against Android SDK 36, Health Connect 1.1.0 and a full JDK 21. This validates compilation only, not permission UX or sensor accuracy. Health Connect supplies historical/provider-recorded steps; the sensor fallback reads the hardware counter during app use and does not install a background tracking service, so continuous capture while the app is closed is not guaranteed. A signed APK must package the final web `dist`, not a placeholder page.

`assembleDebug` succeeded with the actual web game's `dist` bundled. Output: `android/app/build/outputs/apk/debug/app-debug.apk`. This is a development APK signed with a debug key, not a store release. Re-run `cap sync android` and `assembleDebug` after final web changes. Device installation and physical sensor checks remain pending.

`src/platform/DevicePanel.tsx` exposes a standalone UI for permission requests, step session baselines, real readings, health previews and optional explicit diary import. Its optional `onActivityImport(ImportedHealth)` callback must deduplicate overlapping source intervals in the journal and retain the original source metadata. The cloud wallet is visibly separate from the current local adventure. Linking requires an explicit acknowledgement that nutrition records are shared too.


## Existing hosted project deployment

Use the owner's existing project; do not create a replacement. These commands target Supabase CLI 3.x. `project_id = "everstride-local"` in the CLI config is a local workspace label, not a hosted project reference. Authenticate the CLI locally, then run:

```sh
node supabase/sync-core.mjs
node supabase/sync-core.mjs --check
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase db push --remote --dry-run
supabase db push --remote --yes
supabase functions deploy adventure-command --project-ref "$SUPABASE_PROJECT_REF"
```

The real `SUPABASE_PROJECT_REF` must be supplied locally. Review existing table names before applying migrations; these migrations create the game's tables and the isolated `everstride_private` schema and do not drop another application's tables. Enable anonymous sign-ins in the existing project's Auth settings. The browser needs only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; the legacy `VITE_SUPABASE_ANON_KEY` alias remains supported. One reusable browser `supabaseClient` is exported from `src/services/sync.ts`. The Edge Function uses Supabase's server-provided URL, anon key and service-role key. If legacy public keys are disabled, set the function secret `EVERSTRIDE_PUBLISHABLE_KEY` to the public key; never put a service-role key into VITE variables.

## Authoritative adventure integration

After authenticating, create/select a cloud record, acquire its lease, and call `gameSync.executeAdventure(saveId, leaseEpoch, {kind:'initialize'})`. It returns `{snapshot,revision}`. `readAdventure(saveId)` returns the canonical wallet, inventory and stored snapshot for resumption. Subsequent commands include `startBattle`, `beginAttack`, `exerciseUnit`, `manualRemaining`, `resolveEnemy`, `continuePhase`, `finishBattle`, quests, shop, equipment, crafting and movement. Only server-generated snapshots are committed. The command endpoint verifies JWT, membership, exact exercise session IDs, allowed actions, a monotonically fenced lease, revision, and operation ID; rewards follow the shared reducer. A service-only SQL commit atomically persists the adventure, inventory and wallet delta. Concurrent step credits cause a fresh read/retry instead of stale balance replacement.

Use a stable operation ID for retries, serialize commands on the client, and stop at a safe movement boundary if network or control is lost. Do not generate an enemy turn or reward locally while a server command is pending. Camera frames never leave the device; submitted unit events describe local detection and do not constitute server proof of physical movement. `discoverFood` verifies existence with Open Food Facts before granting the unique ingredient. No arbitrary grant-XP/coins/badge or upload-save command exists.

Regenerate the Edge copies whenever `src/core/game.ts`, `contracts.ts`, or `commands.ts` changes. `sync-core.mjs --check` fails on drift. UI integration must likewise route all mutations through these commands to claim a shared adventure. The device panel deliberately keeps the cloud step wallet separate until that routing is enabled.

Automatic table exposure may be disabled: the migrations explicitly grant `USAGE` on the API schema, `SELECT` on member-readable game tables, and `EXECUTE` only on the intended authenticated RPC wrappers. They revoke client writes and keep the privileged adventure commit callable only by `service_role`. RLS is explicitly enabled even if the project also enables it automatically.
