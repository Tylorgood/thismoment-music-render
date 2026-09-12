# Transition Reliability Check

## Fixed

- Consecutive transitions no longer pause the current live element while preparing its replacement.
- Equal-power gain curves run on the Web Audio clock; UI timers only report progress and finalize deck ownership.
- Auto radio preloads its next candidate and waits for playable audio before starting the fade.
- Remaining playback time accounts for playback rate and falls back to saved track duration when streaming media reports an unknown length.
- Short overlap windows skip beat waiting and shorten the fade to fit the remaining audio.
- Track changes, pause, and manual crossfader takeover cancel pending transitions. Repeated Next presses do not abandon an active mix.
- Inactive primary-player events cannot overwrite the live deck's playback state or duration.
- Incoming playback errors preserve the outgoing track and allow a delayed retry.

## Verification

- Production frontend build passed; existing Tailwind duration-class warning remains.
- Eleven Jest checks passed for gain curves, consecutive handoffs, slow loading, playback rate, unknown duration, failure, and cancellation.
- Real headless Chrome test of the production build at a 390 x 844 viewport: five synthetic hard-ending songs, four consecutive automatic handoffs, each with at least 3.5 seconds of overlap for a four-second fade.
- Master-output sampling found no silence gaps (minimum sampled RMS approximately 0.1004).
- No browser JavaScript errors. Pause during a repeated-skip transition stopped both decks.
- The browser fixture deliberately serves chunked audio without a Content-Length header to exercise unknown-duration playback.

Run the reproducible browser check after building with `node scripts/music-transition-smoke.cjs`. Playwright must be resolvable through the installed dependencies or NODE_PATH; the default browser channel is Chrome.

## Remaining Validation

This establishes repeatable foreground-browser transitions with controlled audio, not a guarantee for every phone, background suspension, connection, or source file. Test the user's actual problem tracks, including encoded silent tails and inaccurate saved durations. Source audio that itself cuts out cannot be reconstructed by a crossfade.
