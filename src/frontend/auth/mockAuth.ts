/**
 * Mock auth — local only, no backend.
 * Users + session persist in localStorage. Passwords stored as SHA-256 hashes.
 */
import { useEffect, useState } from "react";

const USERS_KEY = "imperium.users";
const SESSION_KEY = "imperium.session";
const EVT = "imperium:auth";

export interface StoredUser {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Session {
  userId: string;
  email: string;
  fullName: string;
}

function isBrowser() {
  return typeof window !== "undefined";
}

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function readUsers(): StoredUser[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

const DEMO_EMAIL = "fresher.demo@imperium.app";
const DEMO_PASSWORD = "Demo@12345";

export async function ensureDemoUser(): Promise<void> {
  if (!isBrowser()) return;
  const users = readUsers();
  if (users.some((u) => u.email === DEMO_EMAIL)) return;
  users.push({
    id: "demo-fresher-user",
    fullName: "Demo Fresher",
    email: DEMO_EMAIL,
    passwordHash: await sha256(DEMO_PASSWORD),
    createdAt: new Date().toISOString(),
  });
  writeUsers(users);
}

export function getSession(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function setSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(EVT));
}

export async function signUp(input: {
  fullName: string;
  email: string;
  password: string;
}): Promise<Session> {
  const email = input.email.trim().toLowerCase();
  const users = readUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error("An account with that email already exists.");
  }
  const user: StoredUser = {
    id: crypto.randomUUID(),
    fullName: input.fullName.trim(),
    email,
    passwordHash: await sha256(input.password),
    createdAt: new Date().toISOString(),
  };
  writeUsers([...users, user]);
  const session: Session = { userId: user.id, email: user.email, fullName: user.fullName };
  setSession(session);
  return session;
}

export async function signIn(input: {
  email: string;
  password: string;
}): Promise<Session> {
  const email = input.email.trim().toLowerCase();
  const users = readUsers();
  const user = users.find((u) => u.email === email);
  if (!user) throw new Error("No account found for that email.");
  const hash = await sha256(input.password);
  if (hash !== user.passwordHash) throw new Error("Incorrect password.");
  const session: Session = { userId: user.id, email: user.email, fullName: user.fullName };
  setSession(session);
  return session;
}

export function signOut() {
  setSession(null);
}

export function useSession(): Session | null {
  const [session, setS] = useState<Session | null>(() => getSession());
  useEffect(() => {
    const update = () => setS(getSession());
    window.addEventListener(EVT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVT, update);
      window.removeEventListener("storage", update);
    };
  }, []);
  return session;
}
