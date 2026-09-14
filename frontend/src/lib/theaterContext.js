import { useSyncExternalStore } from "react";

let theater = null;
const listeners = new Set();

export function setTheaterContext(next) {
  theater = next;
  listeners.forEach((listener) => listener());
}

export function getTheaterContext() {
  return theater;
}

export function subscribeTheaterContext(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheaterContext() {
  return useSyncExternalStore(subscribeTheaterContext, getTheaterContext, getTheaterContext);
}

export function clearTheaterContext() {
  setTheaterContext(null);
}