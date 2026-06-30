export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  return window.fetch(input, { ...init, headers, credentials: 'same-origin' });
}
