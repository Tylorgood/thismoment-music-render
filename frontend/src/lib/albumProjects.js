const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
const TOKEN_KEY = "album_project_token";

export function getProjectToken() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) || "";
}

export function setProjectToken(token) {
  if (typeof window === "undefined") return;
  const trimmed = (token || "").trim();
  if (trimmed) window.localStorage.setItem(TOKEN_KEY, trimmed);
  else window.localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = { ...(options.headers || {}) };
  if (options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
  }
  let tokenValue = options.token;
  if (tokenValue === undefined) tokenValue = getProjectToken();
  if (["POST", "PUT", "DELETE"].includes(method) && tokenValue) {
    headers["x-album-project-token"] = tokenValue;
  }
  const response = await fetch(`${API_BASE}/api/album-projects${path}`, {
    method,
    headers,
    body: options.body && typeof options.body === "object" ? JSON.stringify(options.body) : options.body,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 403 || response.status === 401) {
      throw new ProjectTokenError(error.detail || "Save token missing or invalid");
    }
    throw new Error(error.detail || `Album project request failed (${response.status})`);
  }
  return response.json();
}

export class ProjectTokenError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProjectTokenError";
  }
}

export function listProjects() {
  return request("");
}

export function getProject(projectId) {
  return request(`/${encodeURIComponent(projectId)}`);
}

export function getProjectVersion(projectId, version) {
  return request(`/${encodeURIComponent(projectId)}/versions/${Number(version)}`);
}

export function createProject(serialized) {
  return request("", { method: "POST", body: serialized });
}

export function saveState(projectId, patch) {
  return request(`/${encodeURIComponent(projectId)}/state`, { method: "PUT", body: patch });
}

export function createVersion(projectId, label = "") {
  return request(`/${encodeURIComponent(projectId)}/versions`, { method: "POST", body: { label } });
}

export function duplicateProject(projectId) {
  return request(`/${encodeURIComponent(projectId)}/duplicate`, { method: "POST", body: {} });
}

export function renameProject(projectId, name) {
  return request(`/${encodeURIComponent(projectId)}/rename`, { method: "POST", body: { name } });
}

export function deleteProject(projectId) {
  return request(`/${encodeURIComponent(projectId)}`, { method: "DELETE" });
}

export async function searchLibraryTracks(query) {
  const response = await fetch(`${API_BASE}/api/music/tracks?query=${encodeURIComponent(query || "")}&sort=title`);
  if (!response.ok) {
    throw new Error(`Library search failed (${response.status})`);
  }
  const body = await response.json();
  return body.tracks || [];
}

export default {
  getProjectToken,
  setProjectToken,
  listProjects,
  getProject,
  getProjectVersion,
  createProject,
  saveState,
  createVersion,
  duplicateProject,
  renameProject,
  deleteProject,
  searchLibraryTracks,
  ProjectTokenError,
};