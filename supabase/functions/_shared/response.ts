import { withCors } from './cors.ts';

export function json(data: unknown, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  );
}

export function error(code: string, message: string, status = 400): Response {
  return json({ code, message }, status);
}
