# CareerKey

CareerKey connects students with employers at recruiting events. Students can build a profile, upload and parse a résumé, rank available positions, and book company time slots. Company users manage their profile, availability, and appointments.

## Technology

- Next.js 16 and React 19
- TypeScript
- Supabase Auth, Postgres, and Storage
- OpenAI Responses API for résumé parsing
- Google Places and Logo.dev for optional company enrichment

## Local setup

Requirements:

- Node.js 20 or newer
- npm
- A configured Supabase project
- OpenAI and Google Maps keys for the corresponding server features

Install and configure the project:

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3001](http://localhost:3001). Replace every placeholder in `.env.local` before exercising authentication or server APIs.

On macOS or Linux, use `cp .env.example .env.local` instead of `copy`.

## Environment variables

| Variable | Visibility | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser and server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser and server | Public Supabase anonymous key; access must be controlled with RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Privileged access used by protected API routes |
| `OPENAI_API_KEY` | Server only | AI résumé extraction |
| `GOOGLE_MAPS_API_KEY` | Server only | Google Places company enrichment |
| `LOGO_DEV_PUBLIC_KEY` | Server only | Optional company logo URLs |

Never commit `.env.local` or expose the service-role, OpenAI, or Google keys through a `NEXT_PUBLIC_` variable.

## Database

The application expects Supabase Auth plus the tables, relationships, uniqueness constraints, storage bucket, and RLS policies described in [docs/database.md](docs/database.md). The repository does not yet contain authoritative migrations, so compare that contract with the active Supabase project before creating migrations.

## Commands

```bash
npm run dev      # development server
npm run lint     # ESLint
npx tsc --noEmit # TypeScript verification
npm run build    # production build
npm start        # serve a completed production build
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be present during `npm run build` because Next.js prerenders client pages that initialize Supabase.

## Application areas

- `/auth`: account creation and sign-in
- `/home`, `/profile`, `/matches`, `/schedule`: student experience
- `/company`: company dashboard, profile, slots, and appointments
- `/admin/positions`: position creation
- `/api/parse-resume`: authenticated, owner-scoped résumé parsing
- `/api/company-insights`: administrator or owning-company enrichment

## Security model

Browser data access uses the Supabase anonymous key and therefore depends on row-level security. Server routes validate a Supabase bearer token before using the service-role client. Résumé parsing additionally requires that the requested résumé belongs to the authenticated user; company enrichment requires an administrator or the owning company account.

When adding a server route, do not use the service-role client until the caller has been authenticated and the target resource has been authorized.
