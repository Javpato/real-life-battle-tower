# Same-Wi-Fi phone camera companion

The phone runs the existing bundled MediaPipe worker locally. A direct WebRTC data channel sends joint coordinates, landmark confidence, capture timestamps and frame dimensions to the desktop. The desktop's existing detector remains responsible for repetitions; canonical game commands remain responsible for damage and rewards. The companion does not authenticate or access any adventure, inventory, cloud save or food journal.

## Integration

Import `CompanionControl` and `PhoneCompanionScreen` from `src/companion`.

- Render the phone screen when `new URLSearchParams(location.search).has('cameraCompanion')` before mounting the game shell. It reads the invite capability from the URL fragment and removes that fragment from browser history after mounting.
- Keep `CompanionControl` mounted while a phone session is active, even if its drawer is visually collapsed. Unmount closes the peer and emits a null frame.
- `onSourceChange('phone'|'webcam')` selects the camera source. `onFrame(PoseFrame|null)` supplies only validated incoming frames. Phone selection must stop webcam capture; null must immediately stop crediting and clear any unfinished detector cycle.
- The phone page never receives exercise rewards or issues gameplay commands. Camera frames stay local unless the phone owner explicitly enables the live peer video preview. Microphone access is never requested.

A desktop creates a five-minute room and displays a real QR code/link. The phone claims that invite once, receives its own separate capability and shows a six-digit challenge. The desktop must explicitly confirm that challenge before SDP or ICE is exchanged. A second phone cannot claim the same invite. Disconnect on either device clears the pose source. Reconnecting requires a new pairing.

ICE uses host candidates only: there are no STUN/TURN providers or video relay. Use the same Wi-Fi; guest/client-isolated networks may prevent direct connectivity. The game and phone link must use HTTPS (localhost is sufficient for automated local tests but a phone cannot use the desktop's localhost address).

## Freshness and privacy

A peer ping/pong measures a clock-offset interval rather than assuming synchronized device clocks. Incoming captures use its conservative oldest-time bound. Reject frames with excessive clock uncertainty, capture age over 500 ms, duplicate/reordered sequences, invalid coordinates/confidence or unexpected landmark counts. No fresh frame for 500 ms emits null. The phone stops its camera when the page goes into the background. Confidence remains detector input, not proof of exercise.

The optional `receivedAt` is receiver-clock arrival time. The transport does not invent one-way latency and does not forward untrusted filtered landmark metadata. There is no video by default, no audio, no media recording and no image/pose payload in the server signaling API. SDP/ICE contain necessary connection metadata (including possible local network addresses); those ephemeral records are capability protected and expire after five minutes.

## Deployment dependency

The existing published game will not pair phones until the owner deploys:

1. `supabase/migrations/202611140006_camera_pair.sql`.
2. `node scripts/sync-companion.mjs` and `node scripts/sync-companion.mjs --check`.
3. Edge Function `camera-pair` with its checked-in `verify_jwt = false` configuration. This function uses independent high-entropy capabilities, not game-save JWTs. Its database functions are callable only with the Edge Function's service role.
4. A scheduled cleanup at least once per minute: delete rows from `everstride_private.camera_pairs` and `everstride_private.camera_pair_limits` where `expires_at <= now()`. Active requests also purge expired rows. Expired records are inaccessible even before physical cleanup runs.

No privileged key enters frontend code. Only the already configured public Supabase URL/publishable key is used in browser fetches. Pairing is rate limited to 12 creates and 1,600 requests per five-minute network bucket, 1,000 requests per room, 64 ICE candidates per peer and bounded request/SDP sizes. All server responses use no-store caching. The signaling namespace has no save or nutrition foreign keys or membership grants.

The last observed owner CLI check returned `AccessTokenRequiredError`; deployment is therefore not claimed. Unlike game saves, this isolated pairing endpoint does not need anonymous Auth enabled. An owner CLI login and an HTTPS deployment remain prerequisites for hosted pairing acceptance. Do not paste access tokens into chat.

## Verification evidence

- `npx vitest run src/companion/companion.test.ts`: single claim, desktop challenge, token separation, expiration, signal bounds, close behavior, clock mapping, stale/reordered data and metadata stripping.
- `node supabase/tests/camera-pair.mjs`: real embedded PostgreSQL, service-only RPC access, anonymous/authenticated denial, CAS fencing, rate limit and expired-session rejection.
- `GAME_URL=http://127.0.0.1:5182 node tests/companion-browser.mjs`: two separate actual Chrome processes establish WebRTC using the same production peer implementation and a deterministic in-memory signaling fixture. Synthetic landmark packets and a fake camera verify pose delivery, explicit preview opt-in/off, timeout/disconnect behavior and no media/pose payload through signaling.

These tests are not a hosted Supabase deployment test and do not validate a physical phone camera, exercise accuracy, Wi-Fi isolation behavior, iOS/Android permissions, thermal performance or background behavior on hardware. Those checks remain explicit acceptance work after deployment.
