// Compatibility entry point: the V2 suite covers the current four-starter flow,
// six skill trees, 90 exercises, dual types, boss rewards, Flash and persistence.
// Keep old callers on the main development server unless they set GAME_URL.
process.env.GAME_URL??='http://127.0.0.1:5174';
await import('./tower-v2-ui-browser.mjs');
