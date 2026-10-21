export function validateEndpoint(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS proxy URL without credentials, query parameters or a fragment. HTTP is allowed only on localhost for development.');
  }
  return url.href;
}

export async function recognize({ frame, confirmed, consent, endpoint, token }, fetcher = fetch) {
  if (!frame?.dataUrl || !confirmed || !consent) throw new Error('Capture, inspect and approve a real camera frame before sending.');
  const url = validateEndpoint(endpoint);
  if (token.trim().startsWith('sk-')) throw new Error('Do not enter an OpenAI key. Use your private proxy access token.');
  if (token.trim().length < 32) throw new Error('Enter your private proxy access token (at least 32 characters).');
  const response = await fetcher(url, {
    method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token.trim()}` },
    body: JSON.stringify({ image: frame.dataUrl }), signal: AbortSignal.timeout(40000)
  });
  if (!response.ok) throw new Error(`Proxy request failed (${response.status}). Check proxy configuration, access token and request limit.`);
  const result = await response.json();
  if (typeof result.description !== 'string') throw new Error('Proxy returned an invalid response.');
  return result.description;
}
