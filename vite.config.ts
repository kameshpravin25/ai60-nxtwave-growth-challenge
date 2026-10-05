import { defineConfig, loadEnv, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * WhatsApp / LinkedIn previews need an absolute og:image URL. On Vercel this is filled in
 * automatically from VERCEL_PROJECT_PRODUCTION_URL; elsewhere set VITE_SITE_URL.
 */
function siteUrl(env: Record<string, string>): Plugin {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : ''
  const url = (env.VITE_SITE_URL || vercel).replace(/\/$/, '')
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url),
  }
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/**
 * Serves `api/<name>.ts` (Vercel-style Web handlers: `export async function POST(request)`) from the
 * Vite dev server, so the evaluator and WhatsApp webhook run locally exactly as they do on Vercel.
 */
function apiRoutes(): Plugin {
  let server: ViteDevServer
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith('/api/')) return next()
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
    const name = url.pathname.slice('/api/'.length).replace(/\/$/, '')
    if (!/^[a-z-]+$/.test(name)) return next()
    try {
      const mod = await server.ssrLoadModule(`/api/${name}.ts`)
      const method = req.method ?? 'GET'
      const fn = mod[method] as ((r: Request) => Promise<Response>) | undefined
      if (!fn) {
        res.statusCode = 405
        return res.end('Method not allowed')
      }
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
      const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req)
      const response = await fn(new Request(url, { method, headers, body }))
      res.statusCode = response.status
      response.headers.forEach((v, k) => res.setHeader(k, v))
      if (response.body) {
        const reader = response.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
      }
      res.end()
    } catch (e) {
      if (e instanceof Error) server.ssrFixStacktrace(e)
      console.error(e)
      res.statusCode = 500
      res.end(e instanceof Error ? e.message : 'Internal error')
    }
  }
  return {
    name: 'api-routes',
    configureServer(s) {
      server = s
      s.middlewares.use(handle)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Server-side handlers read process.env (as on Vercel); expose .env values to them in dev.
  for (const [k, v] of Object.entries(env)) process.env[k] ??= v
  return {
    plugins: [react(), siteUrl(env), apiRoutes()],
  }
})
