export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  return window.fetch(input, { ...init, headers, credentials: 'same-origin' });
}

// Parse a response body without ever throwing.
//
// Callers used to run `const data = await res.json()` and only THEN check
// `res.ok`. When a route crashes, Express returns an HTML error page, so
// `res.json()` throws a SyntaxError. That masks the real failure and, inside a
// mutation handler with no catch, surfaces to the user as nothing at all.
//
// Returning `{}` for a non-JSON body leaves control flow untouched: the caller's
// existing `if (!res.ok) throw new Error(data.error || '...')` still runs, still
// reads the server's message when there is one, and now falls back cleanly when
// there isn't.
export async function safeJson<T = any>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}
