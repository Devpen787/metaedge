export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const sessionId = localStorage.getItem('metaedge_session_id') || '';
  const headers = new Headers(init?.headers);
  if (sessionId) {
    headers.set('x-metaedge-session-id', sessionId);
  }
  return window.fetch(input, { ...init, headers });
}
