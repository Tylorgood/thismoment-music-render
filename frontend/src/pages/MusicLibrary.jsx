import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  Import,
  ListPlus,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const RATINGS = [
  { value: "S", label: "Exceptional" },
  { value: "A", label: "Keeper" },
  { value: "B", label: "Good Idea" },
  { value: "C", label: "Salvage" },
  { value: "D", label: "Dead" },
];
const PLAYLISTS = [
  { value: "smart", label: "Smart flow", detail: "All visible, no S back-to-back" },
  { value: "visible", label: "Visible list", detail: "Search and filter order" },
  { value: "favorites", label: "Favorites", detail: "Hearted tracks only" },
  { value: "keepers", label: "Keepers", detail: "S and A rated tracks" },
  { value: "unrated", label: "Review queue", detail: "Unrated tracks only" },
];
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "song",
  "track",
  "music",
  "sound",
  "style",
  "vocal",
  "instrumental",
]);
const RATING_ENERGY = { S: 5, A: 4, B: 3, C: 2, D: 1 };

function formatDuration(seconds) {
  if (!seconds) return "--:--";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function fileSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(1)} MB`;
}

function artworkSrc(track) {
  return track?.cover_art_endpoint ? `${API_BASE}${track.cover_art_endpoint}` : null;
}

function trackText(track) {
  return [
    track?.display_title,
    track?.original_filename,
    track?.full_generation_prompt,
    track?.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function trackTokens(track) {
  return new Set(
    trackText(track)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
      .slice(0, 80)
  );
}

function similarityScore(current, candidate) {
  if (!current || !candidate) return 0;
  const currentTokens = trackTokens(current);
  const candidateTokens = trackTokens(candidate);
  let shared = 0;
  candidateTokens.forEach((token) => {
    if (currentTokens.has(token)) shared += 1;
  });
  const ratingGap = Math.abs((RATING_ENERGY[current.rating] || 3) - (RATING_ENERGY[candidate.rating] || 3));
  const ratingScore = Math.max(0, 3 - ratingGap) * 0.7;
  const favoriteScore = candidate.favorite ? 0.8 : 0;
  const exceptionalPenalty = current.rating === "S" && candidate.rating === "S" ? 4 : 0;
  return shared * 1.8 + ratingScore + favoriteScore - exceptionalPenalty;
}

function weightedPick(scoredTracks) {
  const weights = scoredTracks.map((item, index) => Math.max(0.25, item.score + 3) / (index + 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let index = 0; index < scoredTracks.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return scoredTracks[index].track;
  }
  return scoredTracks[0]?.track || null;
}

function smartNextTrack(current, queue, recentIds = [], jumpAround = true, playCounts = {}) {
  if (!queue.length) return null;
  const recent = new Set(recentIds);
  const candidates = queue.filter((track) => track.id !== current?.id && !recent.has(track.id));
  const fallbackCandidates = queue.filter((track) => track.id !== current?.id);
  const pool = candidates.length ? candidates : fallbackCandidates;
  if (!pool.length) return queue[0];
  const ranked = pool
    .map((track) => {
      const learnedPenalty = Math.min(3, (playCounts[track.id] || 0) * 0.35);
      return {
        track,
        score: similarityScore(current, track) - learnedPenalty + (jumpAround ? Math.random() * 1.4 : 0),
      };
    })
    .sort((a, b) => b.score - a.score);
  return jumpAround ? weightedPick(ranked.slice(0, Math.min(12, ranked.length))) : ranked[0].track;
}

function randomNextTrack(current, queue, recentIds = []) {
  if (!queue.length) return null;
  const recent = new Set(recentIds);
  const fresh = queue.filter((track) => track.id !== current?.id && !recent.has(track.id));
  const fallback = queue.filter((track) => track.id !== current?.id);
  const pool = fresh.length ? fresh : fallback;
  if (!pool.length) return queue[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

function avoidAdjacentExceptional(items) {
  const queue = [];
  const remaining = [...items];

  while (remaining.length) {
    const lastIsExceptional = queue.at(-1)?.rating === "S";
    let nextIndex = lastIsExceptional ? remaining.findIndex((track) => track.rating !== "S") : 0;
    if (nextIndex === -1) nextIndex = 0;
    queue.push(remaining.splice(nextIndex, 1)[0]);
  }

  return queue;
}

function buildPlaylist(tracks, playlistMode, customPlaylists) {
  if (playlistMode.startsWith("playlist:")) {
    const playlistId = Number(playlistMode.replace("playlist:", ""));
    const playlist = customPlaylists.find((item) => item.id === playlistId);
    const byId = new Map(tracks.map((track) => [track.id, track]));
    return (playlist?.track_ids || []).map((trackId) => byId.get(trackId)).filter(Boolean);
  }

  const filtered = tracks.filter((track) => {
    if (playlistMode === "favorites") return track.favorite;
    if (playlistMode === "keepers") return ["S", "A"].includes(track.rating);
    if (playlistMode === "unrated") return !track.rating;
    return true;
  });

  if (playlistMode === "smart" || playlistMode === "keepers") {
    return avoidAdjacentExceptional(filtered);
  }

  return filtered;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}/api/music${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Music library request failed");
  }
  return response.json();
}

const PLAY_LOG_STORAGE_KEY = "musicAutoDjPlayLog";
const PLAY_COUNTS_STORAGE_KEY = "musicAutoDjPlayCounts";

function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export default function MusicLibrary() {
  const audioRef = useRef(null);
  const deckBRef = useRef(null);
  const incomingMixAudioRef = useRef(null);
  const fadeTimerRef = useRef(null);
  const fadeStartedRef = useRef(false);
  const pendingAutoplayRef = useRef(false);
  const liveAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaGraphRef = useRef(new WeakMap());
  const volumeRef = useRef(0.85);
  const recentTrackIdsRef = useRef([]);
  const lastLoggedPlayRef = useRef({ id: null, at: 0 });
  const [config, setConfig] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [inboxPath, setInboxPath] = useState("");
  const [query, setQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [unratedOnly, setUnratedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState("id");
  const [playlistMode, setPlaylistMode] = useState("smart");
  const [playlists, setPlaylists] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [songSheetOpen, setSongSheetOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [playbackMode, setPlaybackMode] = useState("manual");
  const [smartMix, setSmartMix] = useState(true);
  const [shuffleMix, setShuffleMix] = useState(false);
  const [jumpAround, setJumpAround] = useState(true);
  const [fadeSeconds, setFadeSeconds] = useState(4);
  const [isFading, setIsFading] = useState(false);
  const [djToolsOpen, setDjToolsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [preservePitch, setPreservePitch] = useState(true);
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);
  const [loopActive, setLoopActive] = useState(false);
  const [bookmarks, setBookmarks] = useState({});
  const [waveformBars, setWaveformBars] = useState([]);
  const [volume, setVolume] = useState(0.85);
  const [deckBId, setDeckBId] = useState(null);
  const [deckBPlaying, setDeckBPlaying] = useState(false);
  const [crossfader, setCrossfader] = useState(0);
  const [duplicates, setDuplicates] = useState([]);
  const [playLog, setPlayLog] = useState(() => readStoredJson(PLAY_LOG_STORAGE_KEY, []));
  const [learnedPlays, setLearnedPlays] = useState(() => readStoredJson(PLAY_COUNTS_STORAGE_KEY, {}));
  const [status, setStatus] = useState("Ready");
  const [busy, setBusy] = useState(false);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeId) || null,
    [activeId, tracks]
  );

  const playbackQueue = useMemo(
    () => buildPlaylist(tracks, playlistMode, playlists),
    [playlistMode, playlists, tracks]
  );

  const playlistMeta = useMemo(
    () => {
      if (playlistMode.startsWith("playlist:")) {
        const playlistId = Number(playlistMode.replace("playlist:", ""));
        const playlist = playlists.find((item) => item.id === playlistId);
        if (playlist) return { value: playlistMode, label: playlist.name, detail: `${playlist.track_count} saved tracks` };
      }
      return PLAYLISTS.find((playlist) => playlist.value === playlistMode) || PLAYLISTS[0];
    },
    [playlistMode, playlists]
  );

  const activePlaylist = useMemo(() => {
    if (!playlistMode.startsWith("playlist:")) return null;
    const playlistId = Number(playlistMode.replace("playlist:", ""));
    return playlists.find((item) => item.id === playlistId) || null;
  }, [playlistMode, playlists]);

  const activeTrackInPlaylist = Boolean(activePlaylist?.track_ids.includes(activeTrack?.id));
  const isAutoMode = playbackMode === "auto";

  const activeIndex = useMemo(
    () => playbackQueue.findIndex((track) => track.id === activeTrack?.id),
    [activeTrack, playbackQueue]
  );

  const deckBTrack = useMemo(
    () => tracks.find((track) => track.id === deckBId) || null,
    [deckBId, tracks]
  );

  const suggestedDeckBTrack = useMemo(() => {
    if (!playbackQueue.length) return null;
    if (shuffleMix) return randomNextTrack(activeTrack, playbackQueue, recentTrackIdsRef.current);
    return smartMix
      ? smartNextTrack(activeTrack, playbackQueue, recentTrackIdsRef.current, jumpAround, learnedPlays)
      : playbackQueue[(Math.max(activeIndex, 0) + 1) % playbackQueue.length];
  }, [activeIndex, activeTrack, jumpAround, learnedPlays, playbackQueue, shuffleMix, smartMix]);

  const recentPlayLog = useMemo(() => playLog.slice(0, 5), [playLog]);

  const recordPlay = useCallback(
    (track) => {
      if (!track) return;
      const now = Date.now();
      if (lastLoggedPlayRef.current.id === track.id && now - lastLoggedPlayRef.current.at < 10000) return;

      lastLoggedPlayRef.current = { id: track.id, at: now };
      const entry = {
        id: track.id,
        title: track.display_title,
        playlist: playlistMeta.label,
        playlistMode,
        playedAt: new Date(now).toISOString(),
      };

      setPlayLog((items) => {
        const next = [entry, ...items].slice(0, 200);
        try {
          window.localStorage.setItem(PLAY_LOG_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Local learning is a convenience; playback should never depend on storage.
        }
        return next;
      });

      setLearnedPlays((counts) => {
        const next = { ...counts, [track.id]: (counts[track.id] || 0) + 1 };
        try {
          window.localStorage.setItem(PLAY_COUNTS_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage failures and keep learning for this browser session.
        }
        return next;
      });
    },
    [playlistMeta.label, playlistMode]
  );

  const loadTracks = useCallback(async () => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (ratingFilter) params.set("rating", ratingFilter);
    if (unratedOnly) params.set("unrated", "true");
    if (favoritesOnly) params.set("favorite", "true");
    params.set("sort", sort);
    const data = await api(`/tracks?${params.toString()}`);
    setTracks(data.tracks);
    setStats(data.stats);
    setActiveId((current) => current || data.tracks[0]?.id || null);
  }, [favoritesOnly, query, ratingFilter, sort, unratedOnly]);

  const loadPlaylists = useCallback(async () => {
    const data = await api("/playlists");
    setPlaylists(data.playlists);
    setPlaylistMode((current) => {
      if (!current.startsWith("playlist:")) return current;
      const playlistId = Number(current.replace("playlist:", ""));
      return data.playlists.some((playlist) => playlist.id === playlistId) ? current : "smart";
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    api("/config")
      .then((data) => {
        if (!mounted) return;
        setConfig(data);
        setInboxPath(data.inbox_path);
      })
      .catch((error) => setStatus(error.message));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadTracks().catch((error) => setStatus(error.message));
  }, [loadTracks]);

  useEffect(() => {
    loadPlaylists().catch((error) => setStatus(error.message));
  }, [loadPlaylists]);

  useEffect(() => {
    if (!tracks.length) {
      setActiveId(null);
      return;
    }
    if (!playbackQueue.length) {
      setActiveId(null);
      return;
    }
    setActiveId((current) => (playbackQueue.some((track) => track.id === current) ? current : playbackQueue[0].id));
  }, [playbackQueue, tracks.length]);

  useEffect(() => {
    volumeRef.current = volume;
    const liveAudio = liveAudioRef.current || audioRef.current;
    const liveGraph = liveAudio ? mediaGraphRef.current.get(liveAudio) : null;
    if (liveGraph && audioContextRef.current && !isFading) {
      liveGraph.gain.gain.setTargetAtTime(volume, audioContextRef.current.currentTime, 0.025);
      liveAudio.volume = 1;
    }
    if (audioRef.current && !isFading && !mediaGraphRef.current.get(audioRef.current)) {
      audioRef.current.volume = volume * (1 - crossfader);
    }
    if (deckBRef.current && !isFading) {
      deckBRef.current.volume = volume * crossfader;
    }
  }, [crossfader, isFading, volume]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
    audioRef.current.preservesPitch = preservePitch;
    audioRef.current.mozPreservesPitch = preservePitch;
    audioRef.current.webkitPreservesPitch = preservePitch;
  }, [playbackRate, preservePitch]);

  useEffect(() => {
    if (!deckBRef.current) return;
    deckBRef.current.playbackRate = playbackRate;
    deckBRef.current.preservesPitch = preservePitch;
    deckBRef.current.mozPreservesPitch = preservePitch;
    deckBRef.current.webkitPreservesPitch = preservePitch;
  }, [deckBTrack?.id, playbackRate, preservePitch]);

  useEffect(() => {
    setDraftTitle(activeTrack?.display_title || "");
    setDraftNote(activeTrack?.note || "");
    setLoopStart(null);
    setLoopEnd(null);
    setLoopActive(false);
    setCurrentTime(0);
    setDuration(activeTrack?.duration_seconds || 0);
    setWaveformBars([]);
  }, [activeTrack?.display_title, activeTrack?.duration_seconds, activeTrack?.id, activeTrack?.note]);

  useEffect(() => {
    if (!activeTrack?.id) return;
    let cancelled = false;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const loadWaveform = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/music/tracks/${activeTrack.id}/audio`);
        const buffer = await response.arrayBuffer();
        const context = new AudioContextClass();
        const audioBuffer = await context.decodeAudioData(buffer);
        const channel = audioBuffer.getChannelData(0);
        const bucketCount = 72;
        const bucketSize = Math.max(1, Math.floor(channel.length / bucketCount));
        const bars = Array.from({ length: bucketCount }, (_, index) => {
          const start = index * bucketSize;
          const end = Math.min(channel.length, start + bucketSize);
          let sum = 0;
          let peak = 0;
          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 32) {
            const value = Math.abs(channel[sampleIndex]);
            sum += value * value;
            peak = Math.max(peak, value);
          }
          const sampleCount = Math.max(1, Math.ceil((end - start) / 32));
          const rms = Math.sqrt(sum / sampleCount);
          const height = Math.max(9, Math.min(86, Math.round(12 + rms * 160 + peak * 70)));
          const color = peak > 0.55 ? "high" : rms > 0.09 ? "mid" : "low";
          return { height, color };
        });
        await context.close();
        if (!cancelled) setWaveformBars(bars);
      } catch {
        if (!cancelled) setWaveformBars([]);
      }
    };

    loadWaveform();
    return () => {
      cancelled = true;
    };
  }, [activeTrack?.id]);

  useEffect(() => {
    fadeStartedRef.current = false;
    if (activeTrack?.id) {
      recentTrackIdsRef.current = [activeTrack.id, ...recentTrackIdsRef.current.filter((id) => id !== activeTrack.id)].slice(0, 8);
    }
  }, [activeTrack?.id]);

  const ensureAudioGraph = useCallback((audio, gainValue = volumeRef.current) => {
    if (!audio || typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    const context = audioContextRef.current;
    let graph = mediaGraphRef.current.get(audio);
    if (!graph) {
      const source = context.createMediaElementSource(audio);
      const gain = context.createGain();
      gain.gain.value = gainValue;
      source.connect(gain).connect(context.destination);
      graph = { source, gain };
      mediaGraphRef.current.set(audio, graph);
    }
    graph.gain.gain.setValueAtTime(gainValue, context.currentTime);
    audio.volume = 1;
    return { context, ...graph };
  }, []);

  const getLiveAudio = useCallback(() => liveAudioRef.current || audioRef.current, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack?.id) return;
    const shouldAutoplay = pendingAutoplayRef.current;
    pendingAutoplayRef.current = false;
    const liveAudio = liveAudioRef.current;
    const liveIsSameTrack = liveAudio && incomingMixAudioRef.current === liveAudio && liveAudio.dataset.trackId === activeTrack.id;
    if (liveIsSameTrack) return;
    liveAudioRef.current = audio;
    audio.load();
    if (!shouldAutoplay) return;

    let cancelled = false;
    const playLoadedTrack = () => {
      if (cancelled || !audioRef.current) return;
      const graph = ensureAudioGraph(audioRef.current, volumeRef.current);
      graph?.context.resume?.();
      audioRef.current.play().then(() => {
        liveAudioRef.current = audioRef.current;
        setIsPlaying(true);
      }).catch(() => setIsPlaying(false));
    };

    if (audio.readyState >= 2) {
      playLoadedTrack();
    } else {
      audio.addEventListener("canplay", playLoadedTrack, { once: true });
      window.setTimeout(playLoadedTrack, 350);
    }

    return () => {
      cancelled = true;
      audio.removeEventListener("canplay", playLoadedTrack);
    };
  }, [activeTrack?.id, ensureAudioGraph]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) {
        window.clearInterval(fadeTimerRef.current);
      }
      incomingMixAudioRef.current?.pause();
    };
  }, []);

  const selectTrack = useCallback((trackId, autoplay = false) => {
    if (liveAudioRef.current && liveAudioRef.current !== audioRef.current) {
      liveAudioRef.current.pause();
      liveAudioRef.current = null;
      incomingMixAudioRef.current = null;
    }
    pendingAutoplayRef.current = autoplay;
    setActiveId(trackId);
    setIsPlaying(autoplay);
  }, []);

  const togglePlaybackMode = useCallback(() => {
    const next = playbackMode === "auto" ? "manual" : "auto";
    setPlaybackMode(next);
    if (next === "auto") {
      setSongSheetOpen(false);
      setStatus("Auto radio on");
      const liveAudio = getLiveAudio();
      if (liveAudio) {
        ensureAudioGraph(liveAudio, volumeRef.current)?.context.resume?.();
        liveAudio.play().then(() => {
          liveAudioRef.current = liveAudio;
          setIsPlaying(true);
        }).catch(() => setIsPlaying(false));
      }
    } else {
      setStatus("Manual edit mode");
    }
  }, [ensureAudioGraph, getLiveAudio, playbackMode]);

  const goRelative = useCallback(
    (offset, autoplay = isPlaying) => {
      if (!playbackQueue.length) return;
      if (isAutoMode && offset > 0 && (shuffleMix || smartMix)) {
        const nextTrack = shuffleMix
          ? randomNextTrack(activeTrack, playbackQueue, recentTrackIdsRef.current)
          : smartNextTrack(activeTrack, playbackQueue, recentTrackIdsRef.current, jumpAround, learnedPlays);
        if (nextTrack) {
          selectTrack(nextTrack.id, autoplay);
          setStatus(`${shuffleMix ? "Shuffle" : "Smart mix"}: ${nextTrack.display_title}`);
          return;
        }
      }
      const startIndex = activeIndex >= 0 ? activeIndex : offset < 0 ? 0 : -1;
      const nextIndex = (startIndex + offset + playbackQueue.length) % playbackQueue.length;
      selectTrack(playbackQueue[nextIndex].id, autoplay);
    },
    [activeIndex, activeTrack, isAutoMode, isPlaying, jumpAround, learnedPlays, playbackQueue, selectTrack, shuffleMix, smartMix]
  );

  const loadSuggestedDeckB = useCallback(() => {
    if (!suggestedDeckBTrack) {
      setStatus("No next deck suggestion available");
      return;
    }
    setDeckBId(suggestedDeckBTrack.id);
    setDeckBPlaying(false);
    setStatus(`Deck B loaded: ${suggestedDeckBTrack.display_title}`);
  }, [suggestedDeckBTrack]);

  const toggleDeckBPlayback = useCallback(() => {
    if (!deckBRef.current || !deckBTrack) return;
    if (deckBRef.current.paused) {
      deckBRef.current.play().then(() => {
        setDeckBPlaying(true);
        recordPlay(deckBTrack);
      }).catch(() => setDeckBPlaying(false));
    } else {
      deckBRef.current.pause();
      setDeckBPlaying(false);
    }
  }, [deckBTrack, recordPlay]);

  const swapDeckBToA = useCallback(() => {
    if (!deckBTrack) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (deckBRef.current) {
      deckBRef.current.pause();
      deckBRef.current.currentTime = 0;
    }
    setDeckBPlaying(false);
    setCrossfader(0);
    selectTrack(deckBTrack.id, true);
    setDeckBId(null);
    setStatus(`Deck B live: ${deckBTrack.display_title}`);
  }, [deckBTrack, selectTrack]);

  const seekDeckB = (seconds) => {
    if (!deckBRef.current) return;
    deckBRef.current.currentTime = Math.max(0, deckBRef.current.currentTime + seconds);
  };

  const fadeToNextTrack = useCallback(() => {
    const outgoingAudio = getLiveAudio();
    if (!outgoingAudio || !isAutoMode || !playbackQueue.length || fadeStartedRef.current) return;
    const nextTrack = shuffleMix
      ? randomNextTrack(activeTrack, playbackQueue, recentTrackIdsRef.current)
      : smartMix
        ? smartNextTrack(activeTrack, playbackQueue, recentTrackIdsRef.current, jumpAround, learnedPlays)
        : playbackQueue[(Math.max(activeIndex, 0) + 1) % playbackQueue.length];
    if (!nextTrack || nextTrack.id === activeTrack?.id) return;

    fadeStartedRef.current = true;
    setIsFading(true);
    setStatus(`Mixing into ${nextTrack.display_title}`);
    const fadeMs = Math.max(1, fadeSeconds) * 1000;
    let startedAt = Date.now();
    const originalVolume = volume;
    const incomingAudio = new Audio(`${API_BASE}/api/music/tracks/${nextTrack.id}/audio`);
    incomingMixAudioRef.current?.pause();
    incomingMixAudioRef.current = incomingAudio;
    incomingAudio.dataset.trackId = nextTrack.id;
    incomingAudio.preload = "auto";
    incomingAudio.volume = 1;
    incomingAudio.playbackRate = playbackRate;
    incomingAudio.preservesPitch = preservePitch;
    incomingAudio.mozPreservesPitch = preservePitch;
    incomingAudio.webkitPreservesPitch = preservePitch;
    setDeckBId(nextTrack.id);
    setDeckBPlaying(true);
    setCrossfader(0);

    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current);
    }

    let overlapStarted = false;
    const startOverlap = () => {
      if (overlapStarted) return;
      overlapStarted = true;
      const outgoingGraph = ensureAudioGraph(outgoingAudio, originalVolume);
      const incomingGraph = ensureAudioGraph(incomingAudio, 0);
      const audioContext = incomingGraph?.context || outgoingGraph?.context;
      audioContext?.resume?.();
      incomingAudio.play().then(() => {
        startedAt = Date.now();
        if (audioContext && outgoingGraph && incomingGraph) {
          const now = audioContext.currentTime;
          const fadeDuration = fadeMs / 1000;
          outgoingGraph.gain.gain.cancelScheduledValues(now);
          incomingGraph.gain.gain.cancelScheduledValues(now);
          outgoingGraph.gain.gain.setValueAtTime(originalVolume, now);
          incomingGraph.gain.gain.setValueAtTime(0, now);
          outgoingGraph.gain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);
          incomingGraph.gain.gain.linearRampToValueAtTime(originalVolume, now + fadeDuration);
        }
        recordPlay(nextTrack);
        fadeTimerRef.current = window.setInterval(() => {
          const progress = Math.min(1, (Date.now() - startedAt) / fadeMs);
          if (!audioContext) {
            outgoingAudio.volume = Math.max(0, originalVolume * (1 - progress));
            incomingAudio.volume = Math.min(originalVolume, originalVolume * progress);
          }
          setCrossfader(progress);
          setCurrentTime(incomingAudio.currentTime || 0);
          if (progress >= 1) {
            window.clearInterval(fadeTimerRef.current);
            fadeTimerRef.current = null;
            outgoingAudio.pause();
            if (!audioContext) outgoingAudio.volume = originalVolume;
            liveAudioRef.current = incomingAudio;
            if (incomingGraph && audioContext) {
              incomingGraph.gain.gain.cancelScheduledValues(audioContext.currentTime);
              incomingGraph.gain.gain.setValueAtTime(originalVolume, audioContext.currentTime);
            }
            pendingAutoplayRef.current = false;
            setCurrentTime(incomingAudio.currentTime || 0);
            setActiveId(nextTrack.id);
            setStatus(`Live: ${nextTrack.display_title}`);
            setIsPlaying(true);
            setDeckBPlaying(false);
            setDeckBId(null);
            setCrossfader(0);
            setIsFading(false);
            fadeStartedRef.current = false;
          }
        }, 80);
      }).catch(() => {
        if (fadeTimerRef.current) {
          window.clearInterval(fadeTimerRef.current);
          fadeTimerRef.current = null;
        }
        incomingMixAudioRef.current = null;
        setDeckBPlaying(false);
        setDeckBId(null);
        setCrossfader(0);
        setIsFading(false);
        fadeStartedRef.current = false;
        goRelative(1, true);
      });
    };

    if (incomingAudio.readyState >= 2) {
      startOverlap();
    } else {
      incomingAudio.addEventListener("canplay", startOverlap, { once: true });
      incomingAudio.load();
      window.setTimeout(startOverlap, 450);
    }
  }, [activeIndex, activeTrack, ensureAudioGraph, fadeSeconds, getLiveAudio, goRelative, isAutoMode, jumpAround, learnedPlays, playbackQueue, playbackRate, preservePitch, recordPlay, shuffleMix, smartMix, volume]);

  const handleTimeUpdate = useCallback(() => {
    const audio = getLiveAudio();
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    }
    if (loopActive && loopStart !== null && loopEnd !== null && loopEnd > loopStart && audio.currentTime >= loopEnd) {
      audio.currentTime = loopStart;
      return;
    }
    if (!isAutoMode || (!smartMix && !shuffleMix) || fadeStartedRef.current) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const remaining = audio.duration - audio.currentTime;
    if (remaining > 0 && remaining <= Math.max(1, fadeSeconds)) {
      fadeToNextTrack();
    }
  }, [fadeSeconds, fadeToNextTrack, getLiveAudio, isAutoMode, loopActive, loopEnd, loopStart, shuffleMix, smartMix]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = getLiveAudio();
      if (!audio || audio.paused) return;
      setCurrentTime(audio.currentTime || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
      if (loopActive && loopStart !== null && loopEnd !== null && loopEnd > loopStart && audio.currentTime >= loopEnd) {
        audio.currentTime = loopStart;
        return;
      }
      if (!isAutoMode || (!smartMix && !shuffleMix) || fadeStartedRef.current) return;
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const remaining = audio.duration - audio.currentTime;
      if (remaining > 0 && remaining <= Math.max(1, fadeSeconds)) {
        fadeToNextTrack();
      }
    }, 180);
    return () => window.clearInterval(timer);
  }, [fadeSeconds, fadeToNextTrack, getLiveAudio, isAutoMode, loopActive, loopEnd, loopStart, shuffleMix, smartMix]);

  const updateActiveTrack = useCallback(
    async (patch, advance = false) => {
      if (!activeTrack) return;
      const updated = await api(`/tracks/${activeTrack.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setTracks((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setStatus(`Saved ${updated.id}`);
      if (advance) {
        window.setTimeout(() => goRelative(1, true), 120);
      }
    },
    [activeTrack, goRelative]
  );

  const importInbox = async () => {
    setBusy(true);
    setStatus("Scanning inbox...");
    try {
      const result = await api("/import", {
        method: "POST",
        body: JSON.stringify({ inbox_path: inboxPath || undefined }),
      });
      setDuplicates(result.duplicates || []);
      setStatus(`Imported ${result.imported.length} of ${result.scanned} scanned files`);
      await loadTracks();
      if (!activeId && result.imported[0]) {
        setActiveId(result.imported[0].id);
      }
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  const createPlaylist = async (addCurrentTrack = false) => {
    const name = newPlaylistName.trim();
    if (!name) return;
    setBusy(true);
    try {
      let playlist = await api("/playlists", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (addCurrentTrack && activeTrack) {
        playlist = await api(`/playlists/${playlist.id}/tracks`, {
          method: "POST",
          body: JSON.stringify({ track_id: activeTrack.id }),
        });
      }
      setPlaylists((items) => [...items, playlist].sort((a, b) => a.name.localeCompare(b.name)));
      setPlaylistMode(`playlist:${playlist.id}`);
      setNewPlaylistName("");
      setStatus(addCurrentTrack && activeTrack ? `Created ${playlist.name} and added ${activeTrack.id}` : `Created playlist ${playlist.name}`);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteActivePlaylist = async () => {
    if (!activePlaylist) return;
    if (!window.confirm(`Delete playlist "${activePlaylist.name}"? Songs stay in the library.`)) return;
    try {
      await api(`/playlists/${activePlaylist.id}`, { method: "DELETE" });
      setPlaylists((items) => items.filter((playlist) => playlist.id !== activePlaylist.id));
      setPlaylistMode("smart");
      setStatus(`Deleted playlist ${activePlaylist.name}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const addActiveToPlaylist = async () => {
    if (!activeTrack || !activePlaylist) return;
    await addTrackToPlaylist(activePlaylist);
  };

  const addTrackToPlaylist = async (playlist) => {
    if (!activeTrack || !playlist) return;
    try {
      const updatedPlaylist = await api(`/playlists/${playlist.id}/tracks`, {
        method: "POST",
        body: JSON.stringify({ track_id: activeTrack.id }),
      });
      setPlaylists((items) => items.map((item) => (item.id === updatedPlaylist.id ? updatedPlaylist : item)));
      setStatus(`Added ${activeTrack.id} to ${updatedPlaylist.name}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const removeActiveFromPlaylist = async () => {
    if (!activeTrack || !activePlaylist) return;
    await removeTrackFromPlaylist(activePlaylist);
  };

  const removeTrackFromPlaylist = async (playlist) => {
    if (!activeTrack || !playlist) return;
    try {
      const updatedPlaylist = await api(`/playlists/${playlist.id}/tracks/${activeTrack.id}`, { method: "DELETE" });
      setPlaylists((items) => items.map((item) => (item.id === updatedPlaylist.id ? updatedPlaylist : item)));
      setStatus(`Removed ${activeTrack.id} from ${updatedPlaylist.name}`);
    } catch (error) {
      setStatus(error.message);
    }
  };

  const saveDraftNote = async () => {
    if (!activeTrack) return;
    const note = draftNote;
    setTracks((items) => items.map((item) => (item.id === activeTrack.id ? { ...item, note } : item)));
    try {
      await updateActiveTrack({ note });
    } catch (error) {
      setStatus(error.message);
    }
  };

  const saveDraftTitle = async () => {
    if (!activeTrack) return;
    const displayTitle = draftTitle.trim() || activeTrack.id;
    if (displayTitle === activeTrack.display_title) return;
    setDraftTitle(displayTitle);
    setTracks((items) => items.map((item) => (item.id === activeTrack.id ? { ...item, display_title: displayTitle } : item)));
    try {
      await updateActiveTrack({ display_title: displayTitle });
    } catch (error) {
      setStatus(error.message);
      setDraftTitle(activeTrack.display_title);
      setTracks((items) => items.map((item) => (item.id === activeTrack.id ? activeTrack : item)));
    }
  };

  const deleteActiveTrack = async () => {
    if (!activeTrack) return;
    if (!window.confirm(`Delete "${activeTrack.display_title}" from the library? This removes the library audio copy.`)) return;
    const deletedId = activeTrack.id;
    const fallback =
      playbackQueue.find((track) => track.id !== deletedId)?.id ||
      tracks.find((track) => track.id !== deletedId)?.id ||
      null;
    try {
      getLiveAudio()?.pause();
      await api(`/tracks/${deletedId}`, { method: "DELETE" });
      setTracks((items) => items.filter((track) => track.id !== deletedId));
      setPlaylists((items) =>
        items.map((playlist) => ({
          ...playlist,
          track_ids: playlist.track_ids.filter((trackId) => trackId !== deletedId),
          track_count: playlist.track_ids.filter((trackId) => trackId !== deletedId).length,
        }))
      );
      setActiveId(fallback);
      setIsPlaying(false);
      setStatus(`Deleted ${deletedId}`);
      loadTracks().catch((error) => setStatus(error.message));
    } catch (error) {
      setStatus(error.message);
    }
  };

  const togglePlayback = useCallback(() => {
    const liveAudio = getLiveAudio();
    if (!liveAudio || !activeTrack) return;
    if (liveAudio.paused) {
      ensureAudioGraph(liveAudio, volumeRef.current)?.context.resume?.();
      liveAudio.play().then(() => {
        liveAudioRef.current = liveAudio;
        setIsPlaying(true);
      }).catch(() => setIsPlaying(false));
    } else {
      liveAudio.pause();
      setIsPlaying(false);
    }
  }, [activeTrack, ensureAudioGraph, getLiveAudio]);

  const seek = useCallback((seconds) => {
    const liveAudio = getLiveAudio();
    if (!liveAudio) return;
    liveAudio.currentTime = Math.max(0, liveAudio.currentTime + seconds);
    setCurrentTime(liveAudio.currentTime || 0);
  }, [getLiveAudio]);

  const seekTo = useCallback((seconds) => {
    const liveAudio = getLiveAudio();
    if (!liveAudio) return;
    liveAudio.currentTime = Math.min(Math.max(0, seconds), duration || liveAudio.duration || 0);
    setCurrentTime(liveAudio.currentTime || 0);
  }, [duration, getLiveAudio]);

  const markLoopStart = () => {
    setLoopStart(currentTime);
    setStatus(`Loop in: ${formatDuration(currentTime)}`);
  };

  const markLoopEnd = () => {
    const safeEnd = Math.max(currentTime, (loopStart || 0) + 1);
    setLoopEnd(safeEnd);
    setLoopActive(true);
    setStatus(`Loop out: ${formatDuration(safeEnd)}`);
  };

  const addBookmark = () => {
    if (!activeTrack) return;
    const mark = { time: currentTime, label: formatDuration(currentTime) };
    setBookmarks((items) => ({
      ...items,
      [activeTrack.id]: [...(items[activeTrack.id] || []), mark].sort((a, b) => a.time - b.time),
    }));
    setStatus(`Bookmarked ${activeTrack.id} at ${mark.label}`);
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName);
      if (isTyping) return;
      const key = event.key.toUpperCase();
      if (isAutoMode && ![" ", "ARROWRIGHT", "ARROWLEFT", "ARROWDOWN", "ARROWUP"].includes(key) && event.code !== "Space") return;
      if (["S", "A", "B", "C", "D"].includes(key)) {
        updateActiveTrack({ rating: key }, true).catch((error) => setStatus(error.message));
      } else if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowRight") {
        seek(15);
      } else if (event.key === "ArrowLeft") {
        seek(-15);
      } else if (event.key === "ArrowDown") {
        goRelative(1, true);
      } else if (event.key === "ArrowUp") {
        goRelative(-1, true);
      } else if (key === "F") {
        updateActiveTrack({ favorite: !activeTrack?.favorite }).catch((error) => setStatus(error.message));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTrack, goRelative, isAutoMode, seek, togglePlayback, updateActiveTrack]);

  return (
    <main className={`music-workstation ${isAutoMode ? "auto-mode" : "manual-mode"} ${djToolsOpen ? "dj-open" : "dj-closed"}`}>
      <section className="music-topbar">
        <div>
          <p className="music-kicker">Thismoment</p>
          <h1>Music Library</h1>
        </div>
        <div className="music-status">{status}</div>
      </section>

      <section className="import-strip">
        <label>
          Inbox folder
          <input value={inboxPath} onChange={(event) => setInboxPath(event.target.value)} />
        </label>
        <button onClick={importInbox} disabled={busy}>
          <Import size={16} />
          Import audio
        </button>
        <button onClick={() => loadTracks().catch((error) => setStatus(error.message))}>
          <RefreshCw size={16} />
          Refresh
        </button>
        <span>{config?.database_path}</span>
      </section>

      {duplicates.length > 0 && (
        <section className="duplicate-banner">
          <strong>{duplicates.length} duplicate warning{duplicates.length === 1 ? "" : "s"}:</strong>
          {duplicates.slice(0, 3).map((item) => (
            <span key={`${item.filepath}-${item.duplicate_of}`}>
              {item.filename} matches {item.duplicate_of}
            </span>
          ))}
        </section>
      )}

      <section className="music-grid">
        <aside className="library-panel">
          <div className="filters">
            <label className="search-field">
              <Search size={15} />
              <input placeholder="Search title, file, ID" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)}>
              <option value="">All ratings</option>
              {RATINGS.map((rating) => (
                <option key={rating.value} value={rating.value}>{rating.value} - {rating.label}</option>
              ))}
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="id">Track ID</option>
              <option value="title">Title</option>
              <option value="import_date">Newest import</option>
              <option value="rating">Rating</option>
              <option value="duration">Duration</option>
            </select>
            <label className="check-row">
              <input type="checkbox" checked={unratedOnly} onChange={(event) => setUnratedOnly(event.target.checked)} />
              Unrated
            </label>
            <label className="check-row">
              <input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} />
              Favorites
            </label>
          </div>

          <div className="track-list">
            {playbackQueue.map((track) => (
              <button
                className={`track-row ${track.id === activeTrack?.id ? "active" : ""}`}
                key={track.id}
                onClick={() => selectTrack(track.id, true)}
              >
                <span className="track-thumb">
                  {artworkSrc(track) ? <img src={artworkSrc(track)} alt="" /> : <span>{track.id.slice(1)}</span>}
                </span>
                <span className="track-main">
                  <strong><span className="track-id inline">{track.id}</span>{track.display_title}</strong>
                  <small>{track.original_filename}</small>
                </span>
                <span className={`rating-pill rating-${track.rating || "none"}`}>{track.rating || "-"}</span>
              </button>
            ))}
            {!tracks.length && <div className="empty-library">No tracks yet. Import an inbox to begin.</div>}
            {Boolean(tracks.length) && !playbackQueue.length && (
              <div className="empty-library">No tracks match this playlist and filter combo.</div>
            )}
          </div>
        </aside>

        <section className="review-panel">
          {activeTrack ? (
            <>
              <div className="now-playing">
                {artworkSrc(activeTrack) ? (
                  <img className="now-artwork" src={artworkSrc(activeTrack)} alt="" />
                ) : (
                  <div className="now-artwork placeholder">{activeTrack.id}</div>
                )}
                <div>
                  <span className="track-id large">{activeTrack.id}</span>
                  <button
                    className="song-title-button"
                    onClick={() => (isAutoMode ? setStatus("Switch to manual to edit") : setSongSheetOpen(true))}
                    title={isAutoMode ? "Switch to manual to edit" : "Open song details"}
                  >
                    <h2>{activeTrack.display_title}</h2>
                  </button>
                  <p>{activeTrack.original_filename}</p>
                </div>
                <button
                  className={`favorite-button ${activeTrack.favorite ? "on" : ""}`}
                  onClick={() => updateActiveTrack({ favorite: !activeTrack.favorite }).catch((error) => setStatus(error.message))}
                  title="Favorite (F)"
                >
                  <Heart size={20} fill={activeTrack.favorite ? "currentColor" : "none"} />
                </button>
              </div>

              <audio
                ref={audioRef}
                src={`${API_BASE}/api/music/tracks/${activeTrack.id}/audio`}
                onPlay={() => {
                  setIsPlaying(true);
                  recordPlay(activeTrack);
                }}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(event) => {
                  const loadedDuration = event.currentTarget.duration;
                  if (Number.isFinite(loadedDuration)) {
                    setDuration(loadedDuration);
                  }
                  event.currentTarget.playbackRate = playbackRate;
                  event.currentTarget.preservesPitch = preservePitch;
                  event.currentTarget.mozPreservesPitch = preservePitch;
                  event.currentTarget.webkitPreservesPitch = preservePitch;
                }}
                onEnded={() => {
                  if (isFading) return;
                  if (isAutoMode) {
                    fadeStartedRef.current = false;
                    goRelative(1, true);
                  } else {
                    setIsPlaying(false);
                  }
                }}
                onTimeUpdate={handleTimeUpdate}
                controls
              />

              {deckBTrack && (
                <audio
                  ref={deckBRef}
                  src={`${API_BASE}/api/music/tracks/${deckBTrack.id}/audio`}
                  onEnded={() => setDeckBPlaying(false)}
                  onLoadedMetadata={(event) => {
                    event.currentTarget.volume = volume * crossfader;
                    event.currentTarget.playbackRate = playbackRate;
                    event.currentTarget.preservesPitch = preservePitch;
                    event.currentTarget.mozPreservesPitch = preservePitch;
                    event.currentTarget.webkitPreservesPitch = preservePitch;
                  }}
                />
              )}

              <div className="mode-toggle" role="group" aria-label="Playback mode">
                <button className={!isAutoMode ? "selected" : ""} onClick={togglePlaybackMode}>
                  Manual edit
                </button>
                <button className={isAutoMode ? "selected" : ""} onClick={togglePlaybackMode}>
                  <Radio size={15} />
                  Auto radio
                </button>
              </div>

              <div className="transport">
                <button onClick={() => goRelative(-1, true)} title="Previous">
                  <SkipBack size={18} />
                </button>
                <button className="play-button" onClick={togglePlayback} title="Play/Pause">
                  {isPlaying ? <Pause size={22} /> : <Play size={22} />}
                </button>
                <button onClick={() => goRelative(1, true)} title="Next">
                  <SkipForward size={18} />
                </button>
                <button onClick={() => seek(-15)}>-15s</button>
                <button onClick={() => seek(15)}>+15s</button>
                <label className="volume-control">
                  <Volume2 size={16} />
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                  />
                </label>
              </div>

              <button className="dj-toggle" onClick={() => setDjToolsOpen((value) => !value)}>
                <SlidersHorizontal size={16} />
                <span>{djToolsOpen ? "Hide DJ tools" : "Show DJ tools"}</span>
              </button>

              {djToolsOpen && (
                <div className="dj-controls">
                  <div className="deck-mixer">
                    <DeckStrip label="Deck A" track={activeTrack} playing={isPlaying} />
                    <div className="crossfader-panel">
                      <button onClick={loadSuggestedDeckB} disabled={!suggestedDeckBTrack}>
                        Load next
                      </button>
                      <label>
                        Crossfader
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={crossfader}
                          onChange={(event) => setCrossfader(Number(event.target.value))}
                        />
                      </label>
                      <div className="crossfader-values">
                        <span>A {Math.round((1 - crossfader) * 100)}%</span>
                        <span>B {Math.round(crossfader * 100)}%</span>
                      </div>
                    </div>
                    <DeckStrip label="Deck B" track={deckBTrack || suggestedDeckBTrack} playing={deckBPlaying} ghost={!deckBTrack} />
                  </div>
                  <div className="deck-b-controls">
                    <button onClick={toggleDeckBPlayback} disabled={!deckBTrack}>
                      {deckBPlaying ? <Pause size={16} /> : <Play size={16} />}
                      Deck B
                    </button>
                    <button onClick={() => seekDeckB(-10)} disabled={!deckBTrack}>B -10</button>
                    <button onClick={() => seekDeckB(10)} disabled={!deckBTrack}>B +10</button>
                    <button onClick={swapDeckBToA} disabled={!deckBTrack}>Make B live</button>
                  </div>
                  <WaveformDeck
                    track={activeTrack}
                    bars={waveformBars}
                    currentTime={currentTime}
                    duration={duration}
                    loopStart={loopStart}
                    loopEnd={loopEnd}
                    bookmarks={bookmarks[activeTrack.id] || []}
                    onSeek={seekTo}
                  />
                  <div className="scrub-row">
                    <span>{formatDuration(currentTime)}</span>
                    <input
                      type="range"
                      min="0"
                      max={duration || 0}
                      step="0.1"
                      value={Math.min(currentTime, duration || currentTime)}
                      onChange={(event) => seekTo(Number(event.target.value))}
                    />
                    <span>{formatDuration(duration)}</span>
                  </div>
                  <div className="jump-row">
                    <button onClick={() => seek(-30)}>-30</button>
                    <button onClick={() => seek(-10)}>-10</button>
                    <button onClick={() => seek(10)}>+10</button>
                    <button onClick={() => seek(30)}>+30</button>
                    <button onClick={addBookmark}>Mark</button>
                  </div>
                  <div className="tempo-row">
                    <label>
                      Speed
                      <input
                        type="range"
                        min="0.75"
                        max="1.25"
                        step="0.01"
                        value={playbackRate}
                        onChange={(event) => setPlaybackRate(Number(event.target.value))}
                      />
                      <span>{playbackRate.toFixed(2)}x</span>
                    </label>
                    <label className="pitch-toggle">
                      <input type="checkbox" checked={!preservePitch} onChange={(event) => setPreservePitch(!event.target.checked)} />
                      Pitch shift
                    </label>
                  </div>
                  <div className="loop-row">
                    <button onClick={markLoopStart}>Loop in</button>
                    <button onClick={markLoopEnd} disabled={loopStart === null}>Loop out</button>
                    <button className={loopActive ? "selected" : ""} onClick={() => setLoopActive((value) => !value)} disabled={loopStart === null || loopEnd === null}>
                      Loop
                    </button>
                    <button onClick={() => { setLoopStart(null); setLoopEnd(null); setLoopActive(false); }}>Clear</button>
                  </div>
                  {(bookmarks[activeTrack.id] || []).length > 0 && (
                    <div className="bookmark-row">
                      {(bookmarks[activeTrack.id] || []).map((mark, index) => (
                        <button key={`${mark.time}-${index}`} onClick={() => seekTo(mark.time)}>
                          {mark.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isAutoMode && djToolsOpen && (
                <div className="mix-controls">
                  <label className="mix-toggle">
                    <input
                      type="checkbox"
                      checked={shuffleMix}
                      onChange={(event) => {
                        setShuffleMix(event.target.checked);
                        if (event.target.checked) setSmartMix(false);
                      }}
                    />
                    Random shuffle
                  </label>
                  <label className="mix-toggle">
                    <input
                      type="checkbox"
                      checked={smartMix}
                      onChange={(event) => {
                        setSmartMix(event.target.checked);
                        if (event.target.checked) setShuffleMix(false);
                      }}
                    />
                    Smart mix
                  </label>
                  <label className="mix-toggle">
                    <input type="checkbox" checked={jumpAround} onChange={(event) => setJumpAround(event.target.checked)} />
                    Jump around
                  </label>
                  <label>
                    Fade
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={fadeSeconds}
                      onChange={(event) => setFadeSeconds(Number(event.target.value))}
                    />
                    <span>{fadeSeconds}s</span>
                  </label>
                  {isFading && <span className="mix-live">Mixing</span>}
                </div>
              )}

              {!isAutoMode && (
                <div className="track-actions">
                  <button onClick={addActiveToPlaylist} disabled={!activePlaylist || activeTrackInPlaylist} title="Add to selected playlist">
                    <ListPlus size={16} />
                    Add
                  </button>
                  <button onClick={removeActiveFromPlaylist} disabled={!activePlaylist || !activeTrackInPlaylist} title="Remove from selected playlist">
                    <X size={16} />
                    Remove
                  </button>
                  <button className="danger-button" onClick={deleteActiveTrack} title="Delete song from library">
                    <Trash2 size={16} />
                    Delete song
                  </button>
                </div>
              )}

              {activeTrack.full_generation_prompt && (
                <section className="description-panel">
                  <strong>Suno description</strong>
                  <p>{activeTrack.full_generation_prompt}</p>
                </section>
              )}

              {!isAutoMode && (
                <div className="rating-grid">
                  {RATINGS.map((rating) => (
                    <button
                      key={rating.value}
                      className={activeTrack.rating === rating.value ? "selected" : ""}
                      onClick={() => updateActiveTrack({ rating: rating.value }, true).catch((error) => setStatus(error.message))}
                      title={`Press ${rating.value}`}
                    >
                      <strong>{rating.value}</strong>
                      <span>{rating.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <label className="note-field">
                Short note
                <textarea
                  value={activeTrack.note || ""}
                  placeholder="amazing chorus, verse drags, save the hook..."
                  onChange={(event) => {
                    const note = event.target.value;
                    setTracks((items) => items.map((item) => (item.id === activeTrack.id ? { ...item, note } : item)));
                  }}
                  onBlur={(event) => updateActiveTrack({ note: event.target.value }).catch((error) => setStatus(error.message))}
                />
              </label>

              <div className="metadata-line">
                <span>{formatDuration(activeTrack.duration_seconds)}</span>
                <span>{activeTrack.file_format?.toUpperCase()}</span>
                <span>{fileSize(activeTrack.file_size)}</span>
                <span>{activeIndex >= 0 ? activeIndex + 1 : "-"} of {playbackQueue.length}</span>
              </div>
            </>
          ) : (
            <div className="empty-review">Import tracks to start listening.</div>
          )}
        </section>

        <aside className="stats-panel">
          <h2>Playlists</h2>
          <div className="playlist-create">
            <input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createPlaylist();
              }}
              placeholder="New playlist"
            />
            <button onClick={() => createPlaylist()} disabled={busy || !newPlaylistName.trim()} title="Create playlist">
              <Plus size={16} />
            </button>
          </div>
          <div className="playlist-options">
            {PLAYLISTS.map((playlist) => (
              <button
                key={playlist.value}
                className={playlistMode === playlist.value ? "selected" : ""}
                onClick={() => {
                  setPlaylistMode(playlist.value);
                  setStatus(`${playlist.label} queue ready`);
                }}
              >
                <strong>{playlist.label}</strong>
                <span>{playlist.detail}</span>
              </button>
            ))}
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                className={playlistMode === `playlist:${playlist.id}` ? "selected" : ""}
                onClick={() => {
                  setPlaylistMode(`playlist:${playlist.id}`);
                  setStatus(`${playlist.name} queue ready`);
                }}
              >
                <strong>{playlist.name}</strong>
                <span>{playlist.track_count} saved tracks</span>
              </button>
            ))}
          </div>
          <div className="playlist-now">
            <Sparkles size={16} />
            <span>{playlistMeta.label}: {playbackQueue.length} tracks</span>
          </div>
          <div className="play-log-card">
            <div>
              <strong>Auto DJ memory</strong>
              <span>{playLog.length} plays logged</span>
            </div>
            {recentPlayLog.length ? (
              recentPlayLog.map((entry) => (
                <span key={`${entry.id}-${entry.playedAt}`}>
                  {entry.id} - {entry.title}
                </span>
              ))
            ) : (
              <span>Start playback to begin learning.</span>
            )}
          </div>
          {activePlaylist && (
            <button className="playlist-delete" onClick={deleteActivePlaylist}>
              <Trash2 size={15} />
              Delete playlist
            </button>
          )}

          <h2>Library Stats</h2>
          <Stat label="Total" value={stats?.total_tracks ?? 0} />
          <Stat label="Unrated" value={stats?.unrated_tracks ?? 0} />
          <Stat label="Favorites" value={stats?.favorites_count ?? 0} />
          <Stat label="Rated" value={`${Math.round((stats?.percentage_rated || 0) * 100)}%`} />
          {RATINGS.map((rating) => (
            <Stat key={rating.value} label={`${rating.value} tracks`} value={stats?.rating_counts?.[rating.value] ?? 0} />
          ))}
          <div className="shortcut-card">
            <strong>Shortcuts</strong>
            <span>S/A/B/C/D rate and advance</span>
            <span>F favorite</span>
            <span>Space play/pause</span>
            <span>Arrows skip or move tracks</span>
          </div>
        </aside>
      </section>

      {songSheetOpen && activeTrack && !isAutoMode && (
        <section className="song-sheet" role="dialog" aria-modal="true" aria-label="Song details">
          <button className="song-sheet-backdrop" onClick={() => setSongSheetOpen(false)} aria-label="Close song details" />
          <div className="song-sheet-panel">
            <div className="song-sheet-header">
              {artworkSrc(activeTrack) ? (
                <img src={artworkSrc(activeTrack)} alt="" />
              ) : (
                <span className="song-sheet-art-placeholder">{activeTrack.id}</span>
              )}
              <div>
                <span className="track-id">{activeTrack.id}</span>
                <h2>{activeTrack.display_title}</h2>
                <p>{formatDuration(activeTrack.duration_seconds)} / {activeTrack.rating || "Unrated"}</p>
              </div>
              <button className="sheet-close" onClick={() => setSongSheetOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <label className="sheet-title">
              Track name
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={saveDraftTitle}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                placeholder="Give this version its own name"
              />
            </label>
            <button className="sheet-save" onClick={saveDraftTitle}>Save name</button>

            <label className="sheet-note">
              Comment
              <textarea
                value={draftNote}
                onChange={(event) => setDraftNote(event.target.value)}
                onBlur={saveDraftNote}
                placeholder="Drop notes here: live set moment, needs edit, insane hook..."
              />
            </label>
            <button className="sheet-save" onClick={saveDraftNote}>Save comment</button>

            <div className="sheet-playlists">
              <strong>Add to playlist</strong>
              <div className="sheet-playlist-create">
                <input
                  value={newPlaylistName}
                  onChange={(event) => setNewPlaylistName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") createPlaylist(true);
                  }}
                  placeholder="New playlist"
                />
                <button onClick={() => createPlaylist(true)} disabled={busy || !newPlaylistName.trim()}>
                  <Plus size={16} />
                  Create + add
                </button>
              </div>
              {playlists.length ? (
                playlists.map((playlist) => {
                  const included = playlist.track_ids.includes(activeTrack.id);
                  return (
                    <button
                      key={playlist.id}
                      className={included ? "included" : ""}
                      onClick={() => (included ? removeTrackFromPlaylist(playlist) : addTrackToPlaylist(playlist))}
                    >
                      <span>{playlist.name}</span>
                      <small>{included ? "Remove" : "Add"}</small>
                    </button>
                  );
                })
              ) : (
                <p>Create a playlist above, then use this sheet to add songs.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DeckStrip({ label, track, playing, ghost = false }) {
  return (
    <div className={`deck-strip ${ghost ? "ghost" : ""}`}>
      <span className="deck-label">{label}</span>
      <div className="deck-strip-main">
        {track && artworkSrc(track) ? (
          <img src={artworkSrc(track)} alt="" />
        ) : (
          <span className="deck-art-placeholder">{track?.id || "--"}</span>
        )}
        <div>
          <strong>{track?.display_title || "Load a track"}</strong>
          <small>{track ? `${track.id} / ${formatDuration(track.duration_seconds)}` : "Idle deck"}</small>
        </div>
      </div>
      <span className={`deck-state ${playing ? "on" : ""}`}>{playing ? "Live" : ghost ? "Next" : "Ready"}</span>
    </div>
  );
}

function WaveformDeck({ track, bars: decodedBars, currentTime, duration, loopStart, loopEnd, bookmarks, onSeek }) {
  const fallbackBars = useMemo(() => {
    const seed = trackText(track) || track?.id || "track";
    return Array.from({ length: 72 }, (_, index) => {
      const char = seed.charCodeAt(index % seed.length) || 31;
      const wave = Math.sin((index + 1) * 0.72 + char) + Math.cos((index + 1) * 0.19);
      const height = 18 + Math.abs(wave * 26) + (char % 17);
      const color = index % 4 === 0 ? "low" : index % 3 === 0 ? "high" : "mid";
      return { height: Math.min(74, Math.round(height)), color };
    });
  }, [track]);
  const bars = decodedBars.length ? decodedBars : fallbackBars;

  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const loopLeft = duration && loopStart !== null ? (loopStart / duration) * 100 : null;
  const loopWidth = duration && loopStart !== null && loopEnd !== null ? ((loopEnd - loopStart) / duration) * 100 : null;

  return (
    <button
      className="waveform-deck"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const position = (event.clientX - rect.left) / rect.width;
        onSeek(position * (duration || 0));
      }}
      title="Tap waveform to jump"
    >
      <span className="beat-grid" />
      {loopLeft !== null && loopWidth !== null && loopWidth > 0 && (
        <span className="loop-region" style={{ left: `${loopLeft}%`, width: `${loopWidth}%` }} />
      )}
      <span className="wave-bars">
        {bars.map((bar, index) => (
          <span
            key={`${track?.id || "track"}-${index}`}
            className={`wave-bar ${bar.color} ${index / bars.length * 100 <= progress ? "played" : ""}`}
            style={{ height: `${bar.height}%` }}
          />
        ))}
      </span>
      {bookmarks.map((mark, index) => (
        <span key={`${mark.time}-${index}`} className="cue-marker" style={{ left: `${duration ? (mark.time / duration) * 100 : 0}%` }} />
      ))}
      <span className="playhead" style={{ left: `${progress}%` }} />
    </button>
  );
}
