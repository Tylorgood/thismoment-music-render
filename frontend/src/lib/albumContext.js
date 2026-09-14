import { useSyncExternalStore } from "react";

let state = null;
const listeners = new Set();

export function setAlbumContext(next) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getAlbumContext() {
  return state;
}

export function subscribeAlbumContext(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAlbumContext() {
  return useSyncExternalStore(subscribeAlbumContext, getAlbumContext, getAlbumContext);
}