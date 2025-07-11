import type { RequestHandler } from '@sveltejs/kit';

const API_BASE = 'http://localhost:8080';

export const GET: RequestHandler = async ({ params, url, request }) => {
  const apiUrl = `${API_BASE}/auth/${params.path ?? ''}${url.search}`;
  const res = await fetch(apiUrl, {
    method: 'GET',
    headers: request.headers,
    credentials: 'include'
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: res.headers
  });
};

export const POST: RequestHandler = async ({ params, url, request }) => {
  const apiUrl = `${API_BASE}/auth/${params.path ?? ''}${url.search}`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: request.headers,
    body: request.body,
    credentials: 'include'
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: res.headers
  });
};
