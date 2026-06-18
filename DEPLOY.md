# Deploying Skermtime

Web app → **Vercel**, database/auth → **hosted Supabase**, agent → installed per device.
CI (build + lint + unit tests + agent build) runs on every push via
[`.github/workflows/ci.yml`](.github/workflows/ci.yml).

> Steps that need your accounts/logins are marked **(you)**. Everything else is
> already in the repo.

## 1. Hosted Supabase

1. **(you)** Create a project at supabase.com (pick an EU region for GDPR).
2. Push the schema (migrations live in `supabase/migrations`, incl. RLS + grants):
   ```bash
   pnpm dlx supabase login            # (you) one-time
   pnpm dlx supabase link --project-ref <your-ref>
   pnpm dlx supabase db push
   ```
3. **Auth** → URL Configuration: set **Site URL** to your Vercel URL and add
   `https://<your-domain>/**` to redirect URLs.
4. **Auth → Providers → Google**: enable, paste your Google OAuth client id/secret.
   In Google Cloud, set the authorized redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Copy the project's **URL**, **publishable** key and **secret/service** key for step 2.

## 2. Vercel

1. **(you)** Import the GitHub repo at vercel.com.
2. **Root Directory** → `apps/web` (framework auto-detected as Next.js).
3. **Environment Variables** (Production):
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | project publishable key |
   | `SUPABASE_SECRET_KEY` | project secret/service key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>` |
   | `ANTHROPIC_API_KEY` | (optional) for AI photo checks |
   | `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` / `STRAVA_VERIFY_TOKEN` | (optional) |
   | `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | (optional) |
4. Deploy.

## 3. Webhooks & integrations (after the domain is live)

- **Stripe** → add endpoint `https://<domain>/api/stripe/webhook` for events
  `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`;
  put the signing secret in `STRIPE_WEBHOOK_SECRET`. Create a recurring Price and
  put its id in `STRIPE_PRICE_ID`.
- **Strava** → create a push subscription to `https://<domain>/api/strava/webhook`
  using `STRAVA_VERIFY_TOKEN`. Set the OAuth callback domain to `<domain>`.

## 4. Agent

On each child's PC set `Skermtime:ServerUrl` to `https://<domain>` in
`appsettings.json`, then publish + install as a service (see
[`apps/agent/README.md`](apps/agent/README.md)). Code-sign before wide rollout.

## Notes

- On hosted Supabase the secret/service key bypasses RLS as expected (the
  `sb_secret`-vs-JWT gotcha is local-only).
- Run `pnpm test:integration` / `pnpm test:e2e` locally (they need the dev server
  + local Supabase); CI runs lint, unit tests and builds.
