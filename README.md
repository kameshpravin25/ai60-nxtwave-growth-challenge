# AI60 · Hall Ticket

Working assets for the **NxtWave Growth Intern Challenge**: get 500 final-year engineering students to register for the free workshop *"Build Your First AI Project in 60 Minutes"* in 7 days on ₹2,000.

The brief lists five kinds of asset. This repo builds all five as one system with one data model, so a WhatsApp sign-up appears on the seat chart, the captain leaderboard and the organiser console at once.

| Brief asset | What's built | Route |
|---|---|---|
| Landing page | Lab-record themed page: interview simulator per branch, 60-minute procedure, live 500-seat chart, inter-college standings, viva FAQ | `/` |
| Referral code and tracker | Hall ticket (PNG + QR) whose roll number is the invite code. Batch tiers 1 / 3 / 10, live referrer leaderboard, Campus Captain tracked links with personal scoreboards + printable posters, organiser console with pacing, attribution and "what to do today" | `/`, `/dashboard`, `/captain/<CODE>` |
| WhatsApp flow | Bot: register in 5 taps (lists + buttons), hall ticket in chat, batch invite, T−24h / T−1h reminders, STOP opt-out, project submission with instant evaluation. Simulator + a real WhatsApp Cloud API webhook running the same engine | `/whatsapp`, `/api/whatsapp` |
| Engagement tools during the workshop | Live room synced to the host: per-branch starter code, milestone checklist, "I'm stuck" queue, polls, timed quiz + leaderboard, upvoted Q&A (gold-batch priority), reactions, shipped wall. Host console with completion funnel, common blockers, broadcasts | `/live`, `/host` |
| Automation of AI project evaluation | Liveness check → reads the Hugging Face Space's source → scans for leaked API keys → grades a 5-part rubric with Claude (`claude-opus-5-5`) behind deterministic guardrails → signed certificate, public verify page, LinkedIn add-to-profile | `/submit`, `/verify/<token>` |
| Growth plan | 3 prioritised channels, funnel math, 7-day plan, budget. Prints to 2 A4 pages | `/plan` |
| Reviewer guide | Maps everything to the brief, plus a 3-minute walkthrough | `/tour` |

## Demo mode vs live mode

- **Demo mode** (default, zero setup): a simulated campaign that always opens on **Day 5 of 7**, with fictional captains and students; a live room whose attendees are simulated from the registered seats and react to whatever the host does; an autopilot host so the room is never empty. Everything is labelled as simulated. What you do is stored in your browser.
- **Live mode**: add Supabase keys and every tool runs on Postgres: registrations, the live room (event log) and the WhatsApp bot's sessions. No simulated data.

The evaluator always runs for real (it fetches the submitted URL server-side). Without `ANTHROPIC_API_KEY` it grades with the deterministic rubric and says so.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173  (also serves /api/* like Vercel does)
npm run build      # type-check (app + api) and production build
```

## Deploy (Vercel)

```bash
npx vercel --prod
```

`api/*.ts` deploy as Vercel Functions automatically, and `vercel.json` routes the SPA paths. Set environment variables in *Project → Settings → Environment Variables*:

| Variable | Needed for |
|---|---|
| `VITE_BUILDER_NAME` | Overrides the builder name in the footer, plan and tour (defaults to Kamesh Pravin) |
| `ANTHROPIC_API_KEY` | Claude grading in the evaluator (otherwise the rubric grades) |
| `CERT_SECRET` | Signing certificates (any long random string; the demo key is public) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Live mode |
| `VITE_CAMPAIGN_START`, `VITE_WORKSHOP_AT` | Live-mode dates (ISO 8601 with `+05:30`) |
| `SUPABASE_SERVICE_ROLE_KEY` | WhatsApp bot conversation state (server only) |
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` | WhatsApp Cloud API webhook |

## Go live with Supabase

1. Create a free project at supabase.com → *SQL Editor* → run [`supabase/schema.sql`](supabase/schema.sql).
2. Set the organiser key (CSV export + host console):
   ```sql
   insert into public.app_secrets values ('admin_key', 'choose-a-long-random-string');
   ```
3. Add the `VITE_SUPABASE_*` env vars and redeploy.

**Security model.** Every table has RLS on and no policies, and `anon` has no table grants. All access goes through `security definer` functions:
- `public_seats()` returns first name + last initial only.
- `register()` validates, dedupes on phone/email, allocates seats under an advisory lock, and credits only referral codes that exist.
- `live_join()` swaps hall-ticket code + phone for a room token.
- `live_post()` allows only attendee event kinds, is rate-limited (40/min), and builds name, college and gold status from the registration, never from the client.
- `live_host()` and `admin_export()` need the organiser key.

## WhatsApp bot (optional)

1. Create a Meta app with the WhatsApp product, then get a token and phone-number ID.
2. Webhook URL: `https://<your-domain>/api/whatsapp`, verify token = `WA_VERIFY_TOKEN`, subscribe to `messages`.
3. Set the `WA_*` vars and `SUPABASE_SERVICE_ROLE_KEY`.

Incoming requests are checked against `X-Hub-Signature-256` with `WA_APP_SECRET`. The reminder messages are sent outside the 24-hour window, so they must be registered as message templates. Students reach the bot through a `wa.me/<number>?text=AI60` link on posters and tickets.

## How the evaluator works

1. **Live?** Server-side fetch of the URL. It's SSRF-safe: http(s) only, every redirect hop's DNS answer is checked against private and reserved ranges, with a timeout and a size cap.
2. **Read the project.** For Hugging Face Spaces it reads `runtime.stage`, the file list and the real entry file (`cardData.app_file`). For GitHub, it reads common entry files.
3. **Security scan.** It looks for Gemini, OpenAI, Anthropic, HF and Groq keys in the code (shown redacted), and checks whether the app reads its key from the environment.
4. **Grade.** Claude (`claude-opus-5-5`, structured JSON output, `effort: medium`, server-side refusal fallback) scores 5 criteria. The submission is wrapped as data and the model is told never to follow instructions inside it.
5. **Guardrails Claude can't override.** "Works live" is measured, not judged. Code with no AI call caps "AI use" at 1/5. A leaked key zeroes "craft" and blocks the certificate.
6. **Certificate.** An HMAC-signed, self-contained token, so `/verify/<token>` works without a database. Changing one character invalidates it.

## Tested

- Browser end-to-end (Puppeteer + Chrome) on desktop and mobile: registration, referral loop, live room + host (poll, stuck → resolve, step sync), evaluator → certificate → verify (and tamper rejection), the WhatsApp bot through to STOP, and the captain and tour pages. No console errors, and no horizontal overflow at 390 px.
- Evaluator against real Hugging Face Spaces. A non-AI Space is refused, Gemini Spaces pass, and `127.0.0.1` is blocked.
- Claude path against a mock Messages API. The request shape (model, beta header, `fallbacks`, schema) was verified, along with refusal → rubric fallback and the liveness guardrail.
- WhatsApp webhook against a mock Graph API: handshake, signature check, a full registration conversation, opt-out.
- `schema.sql` in real Postgres (PGlite): registration, dedupe, referral credit, live-room tokens, identity override, rate limit, host key, and that `anon` can't read any table.
- Vercel-style per-file compile of `api/` run in plain Node ESM.

## Design decisions worth knowing

- **Lab record / hall ticket theme.** Every Indian engineering student has written lab records and sat exams with hall tickets. Borrowing those formats makes the page feel like it comes from their world, and a hall ticket is something students screenshot and forward.
- **"Bring your batch" referrals.** Final-year project teams are already 3–4 people, so tier 2 (3 friends) is "your whole batch", and gold-batch students get priority in the live Q&A.
- **A project per branch.** Most mass recruiters hire every branch into tech roles, so non-CSE students are the largest untapped pool.
- **The certificate has to mean something.** It's issued only for a live, AI-using project with no leaked keys, and it can be verified by anyone. Certificates on LinkedIn link to the verify page, which advertises the next cohort.
- **Attendance is the real KPI.** Calendar invites, T−24h checklist, T−1h link, and a completion funnel for the host.
- **The live room is event-sourced.** One pure reducer rebuilds the room from an event log, which is fed by localStorage + BroadcastChannel in the demo and by Supabase in production. Simulated attendees are a pure function of the host's actions and time, so every tab sees the same room.
- **Rejected on purpose:**
  - a "copy this resume line" button before the project is built
  - paid ads (₹2,000 buys reach, not trust)
  - a 3D experience between the student and the form
  - letting the LLM decide whether an app works
