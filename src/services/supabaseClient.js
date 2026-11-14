import { createClient } from '@supabase/supabase-js';

const environment = import.meta.env || {};
const url = (environment.VITE_SUPABASE_URL || '').trim();
const key = (environment.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

function configurationError() {
  if (!url && !key) return '';
  if (!url || !key) return 'Для облачного сохранения заполните обе переменные Supabase в .env.';
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)) return 'VITE_SUPABASE_URL должен содержать HTTPS Project URL из Supabase.';
  if (!key.startsWith('sb_publishable_')) return 'Нужен публичный ключ sb_publishable_… . Секретные и устаревшие ключи в браузере не используются.';
  return '';
}

export const supabaseConfigurationError = configurationError();
export const supabaseConfigured = Boolean(url && key && !supabaseConfigurationError);

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  const abort = () => controller.abort();
  if (init.signal?.aborted) controller.abort();
  else init.signal?.addEventListener('abort', abort, { once: true });
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', abort);
  }
}

export const supabase = supabaseConfigured ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: { fetch: fetchWithTimeout },
}) : null;
