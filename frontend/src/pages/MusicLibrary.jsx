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
const APP_VIEWS = [
  { value: "now", label: "Now" },
  { value: "library", label: "Library" },
  { value: "edit", label: "Edit" },
  { value: "performance", label: "Performance" },
];
const EDIT_TABS = [
  { value: "identity", label: "Identity" },
  { value: "metadata", label: "Metadata" },
  { value: "lyrics", label: "Lyrics" },
  { value: "notes", label: "Notes" },
  { value: "playlists", label: "Playlists" },
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

function originalFamilyName(track) {
  const match = (track?.note || "").match(/^Original family\/name:\s*(.+)$/im);
  return match?.[1]?.trim() || "";
}

function humanOriginalName(track) {
  const filename = track?.original_filename || "";
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\s+-\s+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "")
    .replace(/^\d+\s+-\s+/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceSubname(track) {
  const familyName = originalFamilyName(track);
  if (familyName) return familyName;
  const originalName = humanOriginalName(track);
  if (!originalName || originalName.toLowerCase() === (track?.display_title || "").toLowerCase()) return "";
  return originalName;
}

function analysisSummary(track) {
  const analysis = track?.analysis;
  if (!analysis) return "Not analyzed";
  const parts = [];
  if (analysis.bpm) parts.push(`${Math.round(analysis.bpm)} BPM`);
  if (analysis.key) parts.push(analysis.key);
  if (analysis.energy_label) parts.push(analysis.energy_label);
  return parts.length ? parts.join(" / ") : analysis.status || "Analyzed";
}

function beatInterval(track) {
  const interval = Number(track?.analysis?.beat_interval);
  if (Number.isFinite(interval) && interval > 0) return interval;
  const bpm = Number(track?.analysis?.bpm);
  return Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : null;
}

function firstBeat(track) {
  const offset = Number(track?.analysis?.first_beat);
  return Number.isFinite(offset) && offset >= 0 ? offset : 0;
}

function beatConfidence(track) {
  const confidence = Number(track?.analysis?.beat_confidence);
  if (Number.isFinite(confidence)) return Math.max(0, Math.min(1, confidence));
  const status = track?.analysis?.status;
  if (status === "described") return 0.72;
  if (status === "complete") return 0.78;
  return 0.28;
}

function mixTrustLabel(track) {
  const confidence = beatConfidence(track);
  if (confidence >= 0.78) return "Beat grid locked";
  if (confidence >= 0.58) return "Beat grid guided";
  return "Needs beat review";
}

function nextBeatDelayMs(track, currentTime, minLead = 0.18) {
  const interval = beatInterval(track);
  if (!interval) return 0;
  const origin = firstBeat(track);
  const target = Math.max(currentTime + minLead, origin);
  const beatIndex = Math.ceil((target - origin) / interval);
  const nextBeat = origin + Math.max(0, beatIndex) * interval;
  return Math.max(0, Math.min(900, (nextBeat - currentTime) * 1000));
}

function snapTimeToBeat(track, seconds) {
  const interval = beatInterval(track);
  if (!interval) return seconds;
  const origin = firstBeat(track);
  const beatIndex = Math.max(0, Math.round((seconds - origin) / interval));
  return Math.max(0, origin + beatIndex * interval);
}

function tempoMatchRate(currentTrack, nextTrack, baseRate = 1) {
  const currentBpm = Number(currentTrack?.analysis?.bpm);
  const nextBpm = Number(nextTrack?.analysis?.bpm);
  if (!Number.isFinite(currentBpm) || !Number.isFinite(nextBpm) || currentBpm <= 0 || nextBpm <= 0) return baseRate;
  const ratio = currentBpm / nextBpm;
  if (ratio < 0.92 || ratio > 1.08) return baseRate;
  return Math.max(0.8, Math.min(1.25, baseRate * ratio));
}

function energyClass(track) {
  const label = track?.analysis?.energy_label || "Unknown";
  return `energy-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function trackText(track) {
  return [
    track?.display_title,
    originalFamilyName(track),
    humanOriginalName(track),
    track?.original_filename,
    track?.full_generation_prompt,
    track?.note,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function familyKey(track) {
  return (sourceSubname(track) || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleRoot(track) {
  return (track?.display_title || "")
    .toLowerCase()
    .replace(/\b(skyline|low orbit|blue hour|night bloom|deep room|signal run|velvet air|redline|glass wave|street glow|quiet fire|pulse check|open road|silver room|tape glow|last light|chrome rain|future memory|basement light|soft thunder|hidden floor|moonlit cut|golden circuit|static bloom|clean break|radio bloom|wide awake|gravity mix|livewire|high voltage|ocean drive|shadow lift|second sunrise|club prayer|dream engine|inner lane|northern light|heavy weather|break point|late signal|warm machine|ghost note|bass lantern|violet air|pressure bloom|lost signal|city heat|analog sky|midnight lift)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function lyricsKey(track) {
  const lyrics = (track?.lyrics || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return lyrics.length > 40 ? lyrics.slice(0, 240) : "";
}

function hasBackToBackConflict(current, candidate) {
  if (!current || !candidate) return false;
  if (current.id === candidate.id) return true;
  const currentFamily = familyKey(current);
  const candidateFamily = familyKey(candidate);
  if (currentFamily && candidateFamily && currentFamily === candidateFamily) return true;
  const currentTitle = titleRoot(current);
  const candidateTitle = titleRoot(candidate);
  if (currentTitle && candidateTitle && currentTitle === candidateTitle) return true;
  const currentLyrics = lyricsKey(current);
  const candidateLyrics = lyricsKey(candidate);
  return Boolean(currentLyrics && candidateLyrics && currentLyrics === candidateLyrics);
}

function isUpbeatOpener(track) {
  const text = trackText(track);
  const bpm = track?.analysis?.bpm || 0;
  const energy = track?.analysis?.energy || 0;
  return (
    track?.rating !== "D" &&
    track?.rating !== "S" &&
    (bpm >= 108 || energy >= 0.58 || /upbeat|quick|tempo|club|drive|dnb|dance|groove|bass|sleigh|high energy/.test(text))
  );
}

function pickOpeningTrack(queue, recentIds = [], playCounts = {}) {
  const recent = new Set(recentIds);
  const pool = queue.filter((track) => !recent.has(track.id) && isUpbeatOpener(track));
  const fallback = queue.filter((track) => !recent.has(track.id) && track.rating !== "S") || queue;
  const candidates = pool.length ? pool : fallback.length ? fallback : queue;
  const ranked = candidates
    .map((track) => ({
      track,
      score:
        (track.analysis?.energy || 0.5) * 6 +
        Math.min(3, (track.analysis?.bpm || 100) / 45) +
        (track.favorite ? 1 : 0) -
        Math.min(4, (playCounts[track.id] || 0) * 0.8),
    }))
    .sort((a, b) => b.score - a.score);
  return weightedPick(ranked.slice(0, Math.min(10, ranked.length)));
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
  if (hasBackToBackConflict(current, candidate)) return -100;
  const currentTokens = trackTokens(current);
  const candidateTokens = trackTokens(candidate);
  let shared = 0;
  candidateTokens.forEach((token) => {
    if (currentTokens.has(token)) shared += 1;
  });
  const ratingGap = Math.abs((RATING_ENERGY[current.rating] || 3) - (RATING_ENERGY[candidate.rating] || 3));
  const ratingScore = Math.max(0, 3 - ratingGap) * 0.7;
  const favoriteScore = candidate.favorite ? 0.8 : 0;
  const bpmGap = Math.abs((current.analysis?.bpm || 0) - (candidate.analysis?.bpm || 0));
  const bpmScore = current.analysis?.bpm && candidate.analysis?.bpm ? Math.max(0, 6 - bpmGap / 8) : 0;
  const energyGap = Math.abs((current.analysis?.energy || 0.5) - (candidate.analysis?.energy || 0.5));
  const energyScore = Math.max(0, 2 - energyGap * 4);
  const exceptionalPenalty = candidate.rating === "S" && (current.rating === "S" || (current.analysis?.energy || 0) < 0.58) ? 9 : 0;
  const exceptionalPayoff = candidate.rating === "S" && current.rating !== "S" && (current.analysis?.energy || 0) >= 0.58 ? 2.5 : 0;
  return shared * 1.2 + ratingScore + favoriteScore + bpmScore + energyScore + exceptionalPayoff - exceptionalPenalty;
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
  if (!current) return pickOpeningTrack(queue, recentIds, playCounts);
  const recent = new Set(recentIds);
  const candidates = queue.filter((track) => !hasBackToBackConflict(current, track) && !recent.has(track.id));
  const fallbackCandidates = queue.filter((track) => !hasBackToBackConflict(current, track));
  const lastResort = queue.filter((track) => track.id !== current?.id);
  const pool = candidates.length ? candidates : fallbackCandidates;
  if (!pool.length) return lastResort[0] || queue[0];
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
  if (!current) return pickOpeningTrack(queue, recentIds);
  const recent = new Set(recentIds);
  const fresh = queue.filter((track) => !hasBackToBackConflict(current, track) && !recent.has(track.id));
  const fallback = queue.filter((track) => !hasBackToBackConflict(current, track));
  const lastResort = queue.filter((track) => track.id !== current?.id);
  const pool = fresh.length ? fresh : fallback;
  if (!pool.length) return lastResort[0] || queue[0];
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
const METADATA_FIELDS = [
  { key: "source_platform", label: "Source" },
  { key: "creation_date", label: "Created" },
  { key: "generation_model_version", label: "Model" },
];
const METADATA_TEXT_FIELDS = [
  { key: "full_generation_prompt", label: "Prompt", placeholder: "Style, prompt, or generation notes..." },
  { key: "negative_prompt", label: "Negative prompt", placeholder: "Anything excluded from the generation..." },
  { key: "lyrics", label: "Lyrics", placeholder: "Lyrics or spoken-word text..." },
];

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
  const wakeLockRef = useRef(null);
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
  const [activeView, setActiveView] = useState("now");
  const [editTab, setEditTab] = useState("identity");
  const [draftTitle, setDraftTitle] = useState("");
  const [draftMetadata, setDraftMetadata] = useState({});
  const [draftAnalysis, setDraftAnalysis] = useState({ bpm: "", key: "" });
  const [draftNote, setDraftNote] = useState("");
  const [playbackMode, setPlaybackMode] = useState("manual");
  const [smartMix, setSmartMix] = useState(true);
  const [shuffleMix, setShuffleMix] = useState(false);
  const [smartSync, setSmartSync] = useState(true);
  const [snapToBeat, setSnapToBeat] = useState(true);
  const [keepAwake, setKeepAwake] = useState(true);
  const [wakeLockActive, setWakeLockActive] = useState(false);
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
  const activeTrackId = activeTrack?.id;
  const activeTrackTitle = activeTrack?.display_title || "";
  const activeTrackNote = activeTrack?.note || "";
  const activeTrackDuration = activeTrack?.duration_seconds || 0;
  const activeTrackSourcePlatform = activeTrack?.source_platform || "";
  const activeTrackGenerationId = activeTrack?.source_generation_id || "";
  const activeTrackCreationDate = activeTrack?.creation_date || "";
  const activeTrackModel = activeTrack?.generation_model_version || "";
  const activeTrackCoverUrl = activeTrack?.cover_art_url || "";
  const activeTrackPrompt = activeTrack?.full_generation_prompt || "";
  const activeTrackNegativePrompt = activeTrack?.negative_prompt || "";
  const activeTrackLyrics = activeTrack?.lyrics || "";

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
  const analyzedCount = useMemo(() => tracks.filter((track) => track.analysis).length, [tracks]);

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

  const analyzeLibrary = useCallback(async () => {
    setBusy(true);
    setStatus("Refreshing BPM and track analysis...");
    try {
      const result = await api("/analysis/run", {
        method: "POST",
        body: JSON.stringify({ limit: 250, force: false, mode: "metadata" }),
      });
      setStatus(`Refreshed ${result.count} track${result.count === 1 ? "" : "s"}`);
      await loadTracks();
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }, [loadTracks]);

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
    setDraftTitle(activeTrackTitle);
    setDraftMetadata({
      source_platform: activeTrackSourcePlatform,
      source_generation_id: activeTrackGenerationId,
      creation_date: activeTrackCreationDate,
      generation_model_version: activeTrackModel,
      cover_art_url: activeTrackCoverUrl,
      full_generation_prompt: activeTrackPrompt,
      negative_prompt: activeTrackNegativePrompt,
      lyrics: activeTrackLyrics,
    });
    setDraftAnalysis({
      bpm: activeTrack?.analysis?.bpm ? String(activeTrack.analysis.bpm) : "",
      key: activeTrack?.analysis?.key || "",
    });
    setDraftNote(activeTrackNote);
    setLoopStart(null);
    setLoopEnd(null);
    setLoopActive(false);
    setCurrentTime(0);
    setDuration(activeTrackDuration);
    setWaveformBars([]);
  }, [
    activeTrackDuration,
    activeTrackCoverUrl,
    activeTrackCreationDate,
    activeTrackGenerationId,
    activeTrackId,
    activeTrackLyrics,
    activeTrackModel,
    activeTrackNegativePrompt,
    activeTrackNote,
    activeTrackPrompt,
    activeTrackSourcePlatform,
    activeTrackTitle,
    activeTrack?.analysis?.bpm,
    activeTrack?.analysis?.key,
  ]);

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
    setActiveView("now");
  }, []);

  const togglePlaybackMode = useCallback(() => {
    const next = playbackMode === "auto" ? "manual" : "auto";
    setPlaybackMode(next);
    if (next === "auto") {
      setSongSheetOpen(false);
      setStatus("Auto radio on");
      if (!isPlaying) {
        const opener = pickOpeningTrack(playbackQueue, recentTrackIdsRef.current, learnedPlays);
        if (opener && opener.id !== activeTrack?.id) {
          setStatus(`Opening with ${opener.display_title}`);
          selectTrack(opener.id, true);
          return;
        }
      }
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
  }, [activeTrack?.id, ensureAudioGraph, getLiveAudio, isPlaying, learnedPlays, playbackMode, playbackQueue, selectTrack]);

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

  useEffect(() => {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    navigator.mediaSession.metadata = activeTrack
      ? new window.MediaMetadata({
          title: activeTrack.display_title,
          artist: activeTrack.source_platform || "Thismoment Music Arcade",
          album: playlistMeta.label,
          artwork: artworkSrc(activeTrack)
            ? [{ src: artworkSrc(activeTrack), sizes: "512x512", type: "image/jpeg" }]
            : [],
        })
      : null;
  }, [activeTrack, playlistMeta.label]);

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

  const fadeToNextTrack = useCallback((force = false) => {
    const outgoingAudio = getLiveAudio();
    if (!outgoingAudio || (!isAutoMode && !force) || !playbackQueue.length || fadeStartedRef.current) return;
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
    const matchedRate = smartSync ? tempoMatchRate(activeTrack, nextTrack, playbackRate) : playbackRate;
    incomingAudio.volume = 1;
    incomingAudio.playbackRate = matchedRate;
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
      const incomingStart = smartSync ? Math.min(firstBeat(nextTrack), 8) : 0;
      if (incomingStart > 0 && Number.isFinite(incomingAudio.duration)) {
        incomingAudio.currentTime = incomingStart;
      }
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
        if (smartSync && matchedRate !== playbackRate) {
          setStatus(`Smart sync: ${nextTrack.display_title} at ${Math.round(matchedRate * 100)}% speed`);
        }
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

    const startOnBeat = () => {
      const delayMs = smartSync ? nextBeatDelayMs(activeTrack, outgoingAudio.currentTime || 0) : 0;
      window.setTimeout(startOverlap, delayMs);
    };

    if (incomingAudio.readyState >= 2) {
      startOnBeat();
    } else {
      incomingAudio.addEventListener("canplay", startOnBeat, { once: true });
      incomingAudio.load();
      window.setTimeout(startOnBeat, 450);
    }
  }, [activeIndex, activeTrack, ensureAudioGraph, fadeSeconds, getLiveAudio, goRelative, isAutoMode, jumpAround, learnedPlays, playbackQueue, playbackRate, preservePitch, recordPlay, shuffleMix, smartMix, smartSync, volume]);

  const skipToNextLive = useCallback(() => {
    if (isPlaying && getLiveAudio() && !fadeStartedRef.current) {
      fadeToNextTrack(true);
      return;
    }
    goRelative(1, true);
  }, [fadeToNextTrack, getLiveAudio, goRelative, isPlaying]);

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

  const saveDraftMetadata = async () => {
    if (!activeTrack) return;
    const patch = {};
    [...METADATA_FIELDS, ...METADATA_TEXT_FIELDS].forEach((field) => {
      const value = draftMetadata[field.key] || "";
      if (value !== (activeTrack[field.key] || "")) {
        patch[field.key] = value;
      }
    });
    if (!Object.keys(patch).length) return;
    const optimisticTrack = { ...activeTrack, ...patch };
    setTracks((items) => items.map((item) => (item.id === activeTrack.id ? optimisticTrack : item)));
    try {
      await updateActiveTrack(patch);
    } catch (error) {
      setStatus(error.message);
      setTracks((items) => items.map((item) => (item.id === activeTrack.id ? activeTrack : item)));
    }
  };

  const saveDraftAnalysis = async () => {
    if (!activeTrack) return;
    const patch = {};
    const bpmValue = Number(draftAnalysis.bpm);
    if (draftAnalysis.bpm && Number.isFinite(bpmValue) && bpmValue > 0 && bpmValue !== Number(activeTrack.analysis?.bpm || 0)) {
      patch.analysis_bpm = bpmValue;
    }
    const keyValue = (draftAnalysis.key || "").trim();
    if (keyValue !== (activeTrack.analysis?.key || "")) {
      patch.analysis_key = keyValue;
    }
    if (!Object.keys(patch).length) return;
    try {
      const updated = await updateActiveTrack(patch);
      setDraftAnalysis({
        bpm: updated.analysis?.bpm ? String(updated.analysis.bpm) : "",
        key: updated.analysis?.key || "",
      });
      setStatus(`Locked DJ metadata for ${updated.display_title}`);
    } catch (error) {
      setStatus(error.message);
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
      setActiveView("now");
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
    if (!liveAudio || !activeTrack) return;
    const runSeek = () => {
      const target = Math.max(0, liveAudio.currentTime + seconds);
      liveAudio.currentTime = snapToBeat ? snapTimeToBeat(activeTrack, target) : target;
      setCurrentTime(liveAudio.currentTime || 0);
    };
    if (snapToBeat && !liveAudio.paused) {
      setStatus("Snap armed: jumping on the next beat");
      window.setTimeout(runSeek, nextBeatDelayMs(activeTrack, liveAudio.currentTime || 0, 0.05));
    } else {
      runSeek();
    }
  }, [activeTrack, getLiveAudio, snapToBeat]);

  const seekTo = useCallback((seconds) => {
    const liveAudio = getLiveAudio();
    if (!liveAudio || !activeTrack) return;
    const runSeek = () => {
      const maxDuration = duration || liveAudio.duration || 0;
      const target = Math.min(Math.max(0, seconds), maxDuration);
      liveAudio.currentTime = snapToBeat ? snapTimeToBeat(activeTrack, target) : target;
      setCurrentTime(liveAudio.currentTime || 0);
    };
    if (snapToBeat && !liveAudio.paused) {
      setStatus("Snap armed: dropping on the next beat");
      window.setTimeout(runSeek, nextBeatDelayMs(activeTrack, liveAudio.currentTime || 0, 0.05));
    } else {
      runSeek();
    }
  }, [activeTrack, duration, getLiveAudio, snapToBeat]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    const handlers = {
      play: () => {
        const liveAudio = getLiveAudio();
        if (!liveAudio || !activeTrack) return;
        ensureAudioGraph(liveAudio, volumeRef.current)?.context.resume?.();
        liveAudio.play().then(() => {
          liveAudioRef.current = liveAudio;
          setIsPlaying(true);
        }).catch(() => setIsPlaying(false));
      },
      pause: () => {
        getLiveAudio()?.pause();
        setIsPlaying(false);
      },
      nexttrack: skipToNextLive,
      previoustrack: () => goRelative(-1, true),
      seekbackward: () => seek(-15),
      seekforward: () => seek(15),
    };
    Object.entries(handlers).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Some browsers only support a subset of media session actions.
      }
    });
    return () => {
      Object.keys(handlers).forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Ignore unsupported cleanup paths.
        }
      });
    };
  }, [activeTrack, ensureAudioGraph, getLiveAudio, goRelative, isPlaying, seek, skipToNextLive]);

  useEffect(() => {
    let cancelled = false;

    const releaseWakeLock = async () => {
      if (!wakeLockRef.current) {
        setWakeLockActive(false);
        return;
      }
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      try {
        await lock.release();
      } catch {
        // Wake lock can already be released by the browser.
      }
      if (!cancelled) setWakeLockActive(false);
    };

    const requestWakeLock = async () => {
      if (!keepAwake || !isPlaying || document.visibilityState !== "visible" || !("wakeLock" in navigator)) {
        await releaseWakeLock();
        return;
      }
      if (wakeLockRef.current) return;
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
        wakeLockRef.current.addEventListener("release", () => {
          wakeLockRef.current = null;
          if (!cancelled) setWakeLockActive(false);
        });
        if (!cancelled) setWakeLockActive(true);
      } catch {
        if (!cancelled) setWakeLockActive(false);
      }
    };

    const handleVisibilityChange = () => {
      requestWakeLock();
    };

    requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isPlaying, keepAwake]);

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
        skipToNextLive();
      } else if (event.key === "ArrowUp") {
        goRelative(-1, true);
      } else if (key === "F") {
        updateActiveTrack({ favorite: !activeTrack?.favorite }).catch((error) => setStatus(error.message));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTrack, goRelative, isAutoMode, seek, skipToNextLive, togglePlayback, updateActiveTrack]);

  return (
    <main className={`music-workstation ${isAutoMode ? "auto-mode" : "manual-mode"} ${djToolsOpen ? "dj-open" : "dj-closed"} view-${activeView}`}>
      <section className="music-topbar">
        <div>
          <p className="music-kicker">Thismoment</p>
          <h1>Music Arcade</h1>
          <div className="arcade-marquee" aria-label="System status">
            <span>Live mix engine</span>
            <span>{stats?.total_tracks || tracks.length} tracks online</span>
            <span>{playlistMeta.label}</span>
          </div>
        </div>
        <div className="music-status">{status}</div>
      </section>

      <nav className="view-tabs" aria-label="Music app views">
        {APP_VIEWS.map((view) => (
          <button
            key={view.value}
            className={activeView === view.value ? "selected" : ""}
            onClick={() => {
              setActiveView(view.value);
              if (view.value === "performance") setDjToolsOpen(true);
              if (view.value === "edit" && activeTrack) {
                setSongSheetOpen(true);
                setEditTab("identity");
              }
            }}
          >
            {view.label}
          </button>
        ))}
      </nav>

      <section className="import-strip system-strip">
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
        <button onClick={analyzeLibrary} disabled={busy}>
          <Sparkles size={16} />
          Analyze
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
        <aside className="library-panel app-panel panel-library">
          <div className="filters">
            <label className="search-field">
              <Search size={15} />
              <input placeholder="Search title, family, ID" value={query} onChange={(event) => setQuery(event.target.value)} />
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
              <option value="bpm">BPM</option>
              <option value="energy">Energy</option>
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
                  {track.analysis && <small className={`analysis-line ${energyClass(track)}`}>{analysisSummary(track)}</small>}
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

        <section className="review-panel app-panel panel-now">
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
                    onClick={() => {
                      setActiveView("edit");
                      setEditTab("identity");
                      setSongSheetOpen(true);
                    }}
                    title="Open song details"
                  >
                    <h2>
                      <span>{activeTrack.display_title}</span>
                      {sourceSubname(activeTrack) && <small className="family-name">Family: {sourceSubname(activeTrack)}</small>}
                    </h2>
                  </button>
                  <div className="analysis-pills">
                    <span className={energyClass(activeTrack)}>{analysisSummary(activeTrack)}</span>
                    {activeTrack.analysis?.status && <span>{activeTrack.analysis.status}</span>}
                  </div>
                  <div className="now-state-row">
                    <span className={`status-chip ${isPlaying ? "live" : "ready"}`}>{isPlaying ? "Live" : "Ready"}</span>
                    <span className={`status-chip ${isAutoMode ? "mixing" : "ready"}`}>{isAutoMode ? (shuffleMix ? "Shuffle radio" : smartMix ? "Smart radio" : "Auto radio") : "Manual"}</span>
                    <span className="status-chip">{playlistMeta.label}</span>
                    {keepAwake && <span className={`status-chip ${wakeLockActive ? "live" : "ready"}`}>Awake {wakeLockActive ? "on" : "ready"}</span>}
                  </div>
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

              <div className="next-preview">
                <span>Up next</span>
                <strong>{suggestedDeckBTrack?.display_title || "No next track"}</strong>
                {suggestedDeckBTrack && sourceSubname(suggestedDeckBTrack) && (
                  <small className="family-name">Family: {sourceSubname(suggestedDeckBTrack)}</small>
                )}
                <small>{suggestedDeckBTrack ? `${suggestedDeckBTrack.id} / ${formatDuration(suggestedDeckBTrack.duration_seconds)}` : "Pick a playlist or clear filters"}</small>
              </div>

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
                <button onClick={skipToNextLive} title="Next">
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

              <button
                className="dj-toggle"
                onClick={() => {
                  const nextOpen = !djToolsOpen;
                  setDjToolsOpen(nextOpen);
                  if (nextOpen) setActiveView("performance");
                }}
              >
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
                    <input type="checkbox" checked={keepAwake} onChange={(event) => setKeepAwake(event.target.checked)} />
                    Keep awake {wakeLockActive ? "on" : "ready"}
                  </label>
                  <label className="mix-toggle">
                    <input type="checkbox" checked={smartSync} onChange={(event) => setSmartSync(event.target.checked)} />
                    Smart sync
                  </label>
                  <label className="mix-toggle">
                    <input type="checkbox" checked={snapToBeat} onChange={(event) => setSnapToBeat(event.target.checked)} />
                    Snap to beat
                  </label>
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
                  <span className={`mix-trust ${beatConfidence(activeTrack) >= 0.58 ? "trusted" : "review"}`}>
                    {mixTrustLabel(activeTrack)}
                  </span>
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

        <aside className="stats-panel app-panel panel-system">
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
          <Stat label="Analyzed" value={`${analyzedCount}/${stats?.total_tracks ?? tracks.length}`} />
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

      {songSheetOpen && activeTrack && (
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
                <h2>
                  <span>{activeTrack.display_title}</span>
                  {sourceSubname(activeTrack) && <small className="family-name">Family: {sourceSubname(activeTrack)}</small>}
                </h2>
                <p>{formatDuration(activeTrack.duration_seconds)} / {activeTrack.rating || "Unrated"}</p>
              </div>
              <button className="sheet-close" onClick={() => setSongSheetOpen(false)} title="Close">
                <X size={18} />
              </button>
            </div>

            <div className="sheet-tabs" role="tablist" aria-label="Song editor sections">
              {EDIT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  className={editTab === tab.value ? "selected" : ""}
                  onClick={() => setEditTab(tab.value)}
                  role="tab"
                  aria-selected={editTab === tab.value}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {editTab === "identity" && (
              <div className="sheet-section">
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
                <div className="rating-grid compact">
                  {RATINGS.map((rating) => (
                    <button
                      key={rating.value}
                      className={activeTrack.rating === rating.value ? "selected" : ""}
                      onClick={() => updateActiveTrack({ rating: rating.value }).catch((error) => setStatus(error.message))}
                    >
                      <strong>{rating.value}</strong>
                      <span>{rating.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  className={`sheet-save ${activeTrack.favorite ? "selected" : ""}`}
                  onClick={() => updateActiveTrack({ favorite: !activeTrack.favorite }).catch((error) => setStatus(error.message))}
                >
                  {activeTrack.favorite ? "Remove favorite" : "Mark favorite"}
                </button>
                <div className="analysis-card">
                  <strong>Track Intelligence</strong>
                  <span>{analysisSummary(activeTrack)}</span>
                  <div className="sheet-metadata-grid">
                    <label className="sheet-field">
                      BPM
                      <input
                        value={draftAnalysis.bpm}
                        inputMode="decimal"
                        onChange={(event) => setDraftAnalysis((analysis) => ({ ...analysis, bpm: event.target.value }))}
                        onBlur={saveDraftAnalysis}
                        placeholder="174"
                      />
                    </label>
                    <label className="sheet-field">
                      Key
                      <input
                        value={draftAnalysis.key}
                        onChange={(event) => setDraftAnalysis((analysis) => ({ ...analysis, key: event.target.value }))}
                        onBlur={saveDraftAnalysis}
                        placeholder="A minor"
                      />
                    </label>
                  </div>
                  <button className="sheet-save" onClick={saveDraftAnalysis}>Lock BPM/key</button>
                  <button
                    className="sheet-save"
                    onClick={() => api(`/tracks/${activeTrack.id}/analysis?force=true`, { method: "POST" })
                      .then(() => loadTracks())
                      .then(() => setStatus(`Analyzed ${activeTrack.display_title}`))
                      .catch((error) => setStatus(error.message))}
                  >
                    Re-analyze track
                  </button>
                </div>
              </div>
            )}

            {editTab === "metadata" && (
              <div className="sheet-metadata">
                <strong>Generation Metadata</strong>
                <div className="sheet-metadata-grid">
                  {METADATA_FIELDS.map((field) => (
                    <label key={field.key} className="sheet-field">
                      {field.label}
                      <input
                        value={draftMetadata[field.key] || ""}
                        onChange={(event) => setDraftMetadata((metadata) => ({ ...metadata, [field.key]: event.target.value }))}
                      />
                    </label>
                  ))}
                </div>
                <label className="sheet-field">
                  Prompt
                  <textarea
                    value={draftMetadata.full_generation_prompt || ""}
                    onChange={(event) => setDraftMetadata((metadata) => ({ ...metadata, full_generation_prompt: event.target.value }))}
                    placeholder="Style, prompt, or generation notes..."
                  />
                </label>
                <label className="sheet-field">
                  Negative prompt
                  <textarea
                    value={draftMetadata.negative_prompt || ""}
                    onChange={(event) => setDraftMetadata((metadata) => ({ ...metadata, negative_prompt: event.target.value }))}
                    placeholder="Anything excluded from the generation..."
                  />
                </label>
                <button className="sheet-save" onClick={saveDraftMetadata}>Save metadata</button>
              </div>
            )}

            {editTab === "lyrics" && (
              <div className="sheet-section">
                <label className="sheet-field">
                  Lyrics
                  <textarea
                    value={draftMetadata.lyrics || ""}
                    onChange={(event) => setDraftMetadata((metadata) => ({ ...metadata, lyrics: event.target.value }))}
                    placeholder="Lyrics or spoken-word text..."
                  />
                </label>
                <button className="sheet-save" onClick={saveDraftMetadata}>Save lyrics</button>
              </div>
            )}

            {editTab === "notes" && (
              <div className="sheet-section">
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
              </div>
            )}

            {editTab === "playlists" && (
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
                <button className="danger-button sheet-save" onClick={deleteActiveTrack}>Delete song</button>
              </div>
            )}
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
          <strong>
            <span>{track?.display_title || "Load a track"}</span>
            {track && sourceSubname(track) && <small className="family-name">Family: {sourceSubname(track)}</small>}
          </strong>
          <small>{track ? `${track.id} / ${formatDuration(track.duration_seconds)}` : "Idle deck"}</small>
          {track?.analysis && <small className="deck-analysis">{analysisSummary(track)} / {mixTrustLabel(track)}</small>}
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
  const beatMarkers = useMemo(() => {
    const interval = beatInterval(track);
    if (!duration || !interval) return [];
    const start = firstBeat(track);
    const markers = [];
    for (let time = start; time <= duration && markers.length < 180; time += interval) {
      if (time >= 0) markers.push({ time, bar: markers.length % 4 === 0 });
    }
    return markers;
  }, [duration, track]);

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
      <span className={`beat-grid ${beatConfidence(track) >= 0.58 ? "trusted" : "review"}`} />
      {beatMarkers.map((marker, index) => (
        <span
          key={`${track?.id || "track"}-beat-${index}`}
          className={`beat-marker ${marker.bar ? "bar" : ""}`}
          style={{ left: `${duration ? (marker.time / duration) * 100 : 0}%` }}
        />
      ))}
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
