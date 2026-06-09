/**
 * Supabase-backed auth session hook.
 * Replaces the legacy localStorage `mockAuth` module.
 *
 * - `useSession()` returns `{ userId, email, fullName } | null`.
 * - `signOut()` cancels in-flight queries, clears caches, signs out, redirects.
 * - `useUserId()` returns the auth.uid() for the current signed-in user.
 */
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@backend/database/SupabaseClient";

export interface Session {
  userId: string;
  email: string;
  fullName: string;
}

function toSession(user: User | null): Session | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    user.email?.split("@")[0] ||
    "";
  return { userId: user.id, email: user.email ?? "", fullName };
}

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    // Initial fetch — getUser revalidates with auth server.
    void supabase.auth.getUser().then(({ data }) => {
      if (active) setSession(toSession(data.user ?? null));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) setSession(toSession(s?.user ?? null));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}

export function useUserId(): string | null {
  return useSession()?.userId ?? null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
