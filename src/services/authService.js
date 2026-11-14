import { supabase } from './supabaseClient.js';

export function createAuthService(client = supabase) {
  let inFlight = null;
  const restoreOrCreate = async () => {
    const existing = await client.auth.getSession();
    if (existing.error) throw existing.error;
    if (existing.data.session) return existing.data.session;
    const signedIn = await client.auth.signInAnonymously();
    if (signedIn.error) throw signedIn.error;
    if (!signedIn.data.session) throw new Error('Supabase не создал анонимную сессию. Проверьте Anonymous Sign-Ins.');
    return signedIn.data.session;
  };
  return {
    async ensureSession() {
      if (!client) return null;
      if (inFlight) return inFlight;
      // One operation per tab, plus one account-creation lock across tabs where
      // Web Locks is available. The Supabase SDK uses a different internal lock.
      const locks = globalThis.navigator?.locks;
      inFlight = locks?.request
        ? locks.request('error404:anonymous-session', restoreOrCreate)
        : restoreOrCreate();
      try { return await inFlight; }
      finally { inFlight = null; }
    },
    onChange(callback) {
      if (!client) return () => {};
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
      return () => data.subscription.unsubscribe();
    },
  };
}

export const authService = createAuthService();
