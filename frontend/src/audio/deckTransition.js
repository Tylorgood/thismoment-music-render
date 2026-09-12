export function remainingPlaybackSeconds(audio, knownDuration = 0) {
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(knownDuration);
  if (!(duration > 0)) return Infinity;
  const remaining = duration - Number(audio.currentTime || 0);
  return Number.isFinite(remaining)
    ? Math.max(0, remaining / Math.max(0.1, Number(audio.playbackRate) || 1))
    : Infinity;
}

export function startDeckTransition({
  outgoing, incoming, engine, from, to, seconds, cue = 0, outgoingDuration = 0,
  beatDelay = () => 0, volume = () => 1,
  onStart = () => {}, onProgress = () => {}, onComplete = () => {}, onError = () => {},
}) {
  let stopped = false;
  let starting = false;
  let cueApplied = false;
  let beatTimer;
  let progressTimer;
  let clock;
  const timeout = window.setTimeout(() => fail(new Error("Next song did not load in time")), 20000);

  const cleanup = () => {
    window.clearTimeout(timeout);
    window.clearTimeout(beatTimer);
    window.clearInterval(progressTimer);
    incoming.removeEventListener("loadedmetadata", ready);
    incoming.removeEventListener("canplay", ready);
    incoming.removeEventListener("seeked", ready);
    incoming.removeEventListener("error", mediaError);
  };
  const fail = (error) => {
    if (stopped) return;
    stopped = true;
    cleanup();
    engine?.cancelCrossfade();
    engine?.setCrossfader(from);
    incoming.pause();
    if (!engine) outgoing.volume = volume();
    onError(error);
  };
  const mediaError = () => fail(new Error("Next song could not be played"));
  const begin = async () => {
    if (stopped) return;
    try {
      await engine?.resume();
      if (stopped) return;
      await incoming.play();
      if (stopped) {
        incoming.pause();
        return;
      }
      window.clearTimeout(timeout);
      // Rates above 1 consume the outgoing track faster than wall-clock time.
      const remaining = remainingPlaybackSeconds(outgoing, outgoingDuration);
      const fadeDuration = remaining > 0
        ? Math.max(0.01, Math.min(seconds, remaining - 0.15))
        : Math.min(seconds, 0.7);
      clock = engine?.scheduleCrossfade(from, to, fadeDuration);
      const startedAt = performance.now();
      onStart();
      const tick = () => {
        if (stopped) return;
        const progress = clock ? clock.progress() : Math.min(1, (performance.now() - startedAt) / (fadeDuration * 1000));
        if (!clock) {
          outgoing.volume = volume() * Math.cos(progress * Math.PI / 2);
          incoming.volume = volume() * Math.sin(progress * Math.PI / 2);
        }
        onProgress(progress);
        if (progress < 1) return;
        stopped = true;
        cleanup();
        // Publish ownership before pause events from the old deck can fire.
        onComplete();
        outgoing.pause();
      };
      progressTimer = window.setInterval(tick, 50);
      tick();
    } catch (error) {
      fail(error);
    }
  };
  function ready() {
    if (stopped || starting) return;
    if (!cueApplied && incoming.readyState >= 1) {
      cueApplied = true;
      if (cue > 0 && cue < incoming.duration) incoming.currentTime = cue;
    }
    if (incoming.readyState < 3 || incoming.seeking) return;
    starting = true;
    // Do not wait for a beat if doing so would consume the overlap window.
    const available = remainingPlaybackSeconds(outgoing, outgoingDuration) - seconds - 0.15;
    const delay = Math.max(0, beatDelay());
    beatTimer = window.setTimeout(begin, available >= delay / 1000 ? delay : 0);
  }
  incoming.addEventListener("loadedmetadata", ready);
  incoming.addEventListener("canplay", ready);
  incoming.addEventListener("seeked", ready);
  incoming.addEventListener("error", mediaError);
  if (!engine) incoming.volume = 0;
  ready();
  return () => {
    if (stopped) return;
    stopped = true;
    cleanup();
    engine?.cancelCrossfade();
    engine?.setCrossfader(from);
    incoming.pause();
    if (!engine) outgoing.volume = volume();
  };
}
