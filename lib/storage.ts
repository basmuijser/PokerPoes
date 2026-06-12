"use client";

const KEY = (roomCode: string) => `pokerpoes:room:${roomCode}`;

export interface RoomIdentity {
  playerId: string;
  isHost: boolean;
  name: string;
}

export function saveIdentity(roomCode: string, id: RoomIdentity) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(roomCode), JSON.stringify(id));
  } catch {}
}

export function loadIdentity(roomCode: string): RoomIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(roomCode));
    return raw ? (JSON.parse(raw) as RoomIdentity) : null;
  } catch {
    return null;
  }
}

export function clearIdentity(roomCode: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY(roomCode));
  } catch {}
}
