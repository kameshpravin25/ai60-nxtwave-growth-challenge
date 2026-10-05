import { isDemoSecret, verify } from './_lib/certs.js'

/** GET /api/verify?t=<certificate token> → { valid, payload, demoSignature } */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('t') ?? ''
  const result = token.length > 20 && token.length < 2000 ? verify(token) : { valid: false, payload: null }
  return new Response(JSON.stringify({ ...result, demoSignature: isDemoSecret() }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  })
}
