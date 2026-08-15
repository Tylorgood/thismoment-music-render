const rawSupabaseUrl = process.env.REACT_APP_SUPABASE_URL || "";
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes("your-project-ref") &&
    !supabaseAnonKey.includes("your-public-anon-key")
);

const SESSION_KEY = "this-moment-v2-supabase-session";
const REQUEST_TIMEOUT_MS = 15000;

function getStoredSession() {
  try {
    const hashSession = getSessionFromHash();
    if (hashSession) return hashSession;
    return JSON.parse(window.localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function getSessionFromHash() {
  if (!window.location.hash || !window.location.hash.includes("access_token")) {
    return null;
  }
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) return null;

  const session = {
    access_token: accessToken,
    refresh_token: params.get("refresh_token"),
    token_type: params.get("token_type") || "bearer",
    expires_in: Number(params.get("expires_in") || 0),
    expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || 0),
  };
  storeSession(session);
  window.history.replaceState({}, document.title, window.location.pathname);
  return session;
}

function storeSession(session) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

function isExpired(session) {
  if (!session?.expires_at) return false;
  return Number(session.expires_at) <= Math.floor(Date.now() / 1000) + 30;
}

async function refreshSession(session) {
  if (!session?.refresh_token) {
    storeSession(null);
    return null;
  }

  try {
    const refreshed = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: { refresh_token: session.refresh_token },
      auth: false,
    });
    const nextSession = { ...refreshed, user: refreshed.user || session.user };
    storeSession(nextSession);
    return nextSession;
  } catch {
    storeSession(null);
    return null;
  }
}

async function getValidSession() {
  const session = getStoredSession();
  if (!session) return null;
  if (isExpired(session)) return refreshSession(session);
  return session;
}

async function request(path, { method = "GET", body, headers = {}, auth = true } = {}) {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured.");
  const session = auth ? await getValidSession() : getStoredSession();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${supabaseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: auth && session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    throw new Error(
      timedOut
        ? `Supabase did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds. The project may be waking up or your connection may be blocked.`
        : `Cannot reach Supabase at ${supabaseUrl}. Re-copy the Project URL from Supabase Project Settings > API and restart the app.`
    );
  } finally {
    window.clearTimeout(timeout);
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || payload?.error_description || payload?.hint || text || response.statusText);
  }
  return payload;
}

async function requestWithRetry(path, options = {}) {
  try {
    return await request(path, options);
  } catch (error) {
    const message = String(error?.message || "");
    const retryable =
      message.includes("Cannot reach Supabase") ||
      message.includes("did not respond") ||
      message.includes("JWT expired");
    if (!retryable) throw error;
    await new Promise((resolve) => window.setTimeout(resolve, 750));
    return request(path, options);
  }
}

function table(name) {
  return {
    list: (query = "") => requestWithRetry(`/rest/v1/${name}${query}`, { headers: { Prefer: "return=representation" } }),
    insert: (record) => requestWithRetry(`/rest/v1/${name}`, { method: "POST", body: record, headers: { Prefer: "return=representation" } }),
    update: (id, patch) =>
      requestWithRetry(`/rest/v1/${name}?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: patch,
        headers: { Prefer: "return=representation" },
      }),
  };
}

function rpc(name, body = {}) {
  return requestWithRetry(`/rest/v1/rpc/${name}`, {
    method: "POST",
    body,
    headers: { Prefer: "return=representation" },
  });
}

export const supabase = isSupabaseConfigured
  ? {
      auth: {
        async getSession() {
          const session = await getValidSession();
          if (session?.access_token && !session.user) {
            const user = await request("/auth/v1/user", {
              method: "GET",
              headers: { Authorization: `Bearer ${session.access_token}` },
              auth: false,
            });
            const hydrated = { ...session, user };
            storeSession(hydrated);
            return { data: { session: hydrated }, error: null };
          }
          return { data: { session }, error: null };
        },
        async signInWithPassword({ email, password }) {
          const data = await request("/auth/v1/token?grant_type=password", {
            method: "POST",
            body: { email, password },
            auth: false,
          });
          storeSession(data);
          return { data: { session: data, user: data.user }, error: null };
        },
        async signUp({ email, password }) {
          const data = await request("/auth/v1/signup", {
            method: "POST",
            body: { email, password },
            auth: false,
          });
          if (data?.access_token) storeSession(data);
          return { data: { session: data?.access_token ? data : null, user: data.user }, error: null };
        },
        async signOut() {
          storeSession(null);
          return { error: null };
        },
        clearLocalSession() {
          storeSession(null);
        },
        onAuthStateChange(callback) {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
      table,
      rpc,
      functions: {
        async invoke(name, { body }) {
          try {
            const data = await requestWithRetry(`/functions/v1/${name}`, { method: "POST", body });
            return { data, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      },
      diagnostics: {
        async healthCheck() {
          const startedAt = Date.now();
          const authSettings = await requestWithRetry("/auth/v1/settings", { auth: false });
          const restProbe = await requestWithRetry("/rest/v1/accounts?select=id&limit=1", { auth: true });
          return {
            ok: true,
            supabaseUrl,
            elapsedMs: Date.now() - startedAt,
            emailAuthEnabled: Boolean(authSettings?.external?.email),
            restReachable: Array.isArray(restProbe),
            hasSession: Boolean(getStoredSession()?.access_token),
            sessionExpiresAt: getStoredSession()?.expires_at || null,
          };
        },
      },
    }
  : null;
