# Skermtime

Tjänst som låter barn **tjäna skärmtid** genom fysisk aktivitet (Strava) och sysslor.
En agent på barnets dator räknar ner det intjänade saldot och låser skärmen när det tar slut.
Säljs som SaaS-abonnemang per familj.

> Se **[PLAN.md](./PLAN.md)** för full produktplan, arkitektur och roadmap.

## Stack
- **Webb:** Next.js (App Router, TypeScript) på Vercel
- **Backend/DB:** Supabase (Postgres + RLS, Auth, Storage)
- **Betalning:** Stripe Billing
- **Agent:** .NET 10 Worker Service (Windows)

## Monorepo-struktur
```
apps/
  web/        Next.js – marknadssajt + app + API/webhooks
  agent/      .NET-agent för Windows (fas 3)
packages/
  shared/     Delade TypeScript-kontrakt/typer
supabase/     Migrationer + lokal konfig
```

## Kom igång (fylls på allteftersom)
```bash
pnpm install
pnpm dev            # kör Next.js-appen
pnpm db:start       # lokal Supabase (kräver Docker)
```

Krav: Node 22+, pnpm 10+, .NET 10 SDK (för agenten), Docker (för lokal Supabase).
