# Skermtime — Produktplan (ax till limpa)

> **Status:** levande dokument. Uppdateras allteftersom.
> **I en mening:** Skermtime gör skärmtid till något barn *tjänar* genom att röra på sig (Strava) och hjälpa till (sysslor) — en agent på datorn räknar ner saldot och låser skärmen när det tar slut. Säljs som SaaS-abonnemang per familj.

---

## Status — 2026-06-17 (autonom byggspurt)

Fas 0–5 implementerade och verifierade lokalt:
- ✅ Monorepo, Supabase (5 migrationer, RLS verifierat), Next.js 16
- ✅ Förälder-auth (magic-link + Google-knapp), familj + barnprofiler
- ✅ Intjäningsmotor + plånbok/liggare, sysslor (bibliotek + egna), godkännanden, Strava, AI-fotoverifiering
- ✅ Enhetsparning + .NET 10-agent (nedräkning, lås, tamper→bonus)
- ✅ Stripe-prenumerationer (Checkout, kundportal, webhook, gating)
- ✅ Tester: 23 enhetstester + 5 integrationstester (agent-loop end-to-end); build + lint rena; agenten bygger

**Kräver dina hemligheter/konton för skarp drift:** Google OAuth, Strava-klient, `ANTHROPIC_API_KEY`, Stripe-nycklar; deploy till Vercel + hostad Supabase; kodsignering av agenten.

---

## Beslutslogg (låsta beslut)

| # | Beslut | Motivering |
|---|--------|-----------|
| 1 | **Stack: Vercel + Supabase + Next.js (TypeScript)** för webbprodukten | Mainstream, snabb, billig att drifta, låg ops. Supabase RLS = ren multi-tenancy. |
| 2 | **Windows-agenten i .NET** (.NET 10) | Rätt verktyg för en Windows-tjänst; utvecklarens starkaste språk. Pratar bara HTTP mot backend. |
| 3 | **Tamper → bonus, inte straff** | Vi uppmuntrar nyfiket/hackande beteende. Detektion → bonusminuter + notis till förälder. Anti-farming: per unik teknik, med tak. |
| 4 | **Code signing uppskjutet** | Osignerad agent under dogfooding; signeras inför publik launch. |
| 5 | **Alias-only barn, ingen PII** | Kunden är föräldern (vuxen). Barn = förnamn/alias + PIN-hash. Vanlig B2C-hygien, ingen tung barndataregim. |
| 6 | **Pris (platshållare): 49 kr/mån/familj, 14 dagars trial** | Biter först i fas 4. Lätt att ändra. |
| 7 | **Auth: Google först**, sen Microsoft + användarnamn/lösen | Snabbast till launch; Supabase Auth gör utökningen trivial. |
| 8 | **Syssel-bibliotek (delat) + egna sysslor** (förälder & barn), justerbar belöning, sensible defaults | Flexibelt utan tom-lista-känsla. Barn-skapade belöningar kräver förälder-OK. |
| 9 | **AI-verifiering av fotobevis** (Claude vision) för utvalda sysslor (t.ex. diskmaskin före/efter) | Minskar manuellt godkännande; faller tillbaka till förälder vid osäkerhet. |

---

## 1. Designprinciper
- Föräldern har alltid sista ordet (override när som helst).
- Rättvist & transparent för barnet — hen ser sitt saldo och *varför* det ändras.
- Robust mot nätstrul — straffa aldrig barnet för en router som hänger.
- "Good enough"-fusksäkert — avskräckare, inte fängelse. (Och fusk-*försök* belönas, se §7.)

## 2. Personas & kärnflöden
- **Föräldern (owner):** registrerar familj → 14 dagars trial → skapar barnprofil → sätter regler → parar barnets PC → godkänner sysslor → ser historik → hanterar abonnemang.
- **Barnet:** loggar in enkelt (alias + PIN, ingen e-post) → ser saldo → bockar sysslor → kopplar sin Strava → ser hur rundor ger tid.
- **Agenten (barnets PC):** paras en gång → räknar ner aktiv tid → varnar (10/5/1 min) → låser vid noll → rapporterar förbrukning.

## 3. Arkitektur
```
                         ┌───────────────────────────────────────┐
   Strava ──webhook────► │  Next.js på Vercel (App Router, TS)    │
                         │  • Marknadssajt + app + API-routes      │
   Barnets PC ◄──HTTPS─► │  • Strava/Stripe webhooks               │ ◄── Förälder/barn (webb, mobil)
    (.NET-agent,         │  • Intjäningsmotor                      │
     parad mot barn)     └───────────────────┬─────────────────────┘
                                             │
   Stripe ──webhook──────────────────────────┤
                                             ▼
                              ┌──────────────────────────┐
                              │  Supabase                 │
                              │  Postgres + RLS · Auth ·  │
                              │  Storage · Edge Functions │
                              └──────────────────────────┘
```
**Verktyg:** Next.js (App Router) + TypeScript · Tailwind + shadcn/ui · Supabase (Postgres/Auth/Storage) · Drizzle ORM (typed migrations) · Stripe (Billing) · Resend (transaktionsmejl) · Sentry (fel) · Playwright (e2e).
**Agent:** .NET 10 Worker Service · MSIX-paket · Velopack (auto-update) · DPAPI (tokenförvar).

## 4. Datamodell & multi-tenancy
Tenant = **family**. Allt scopas med `family_id` och RLS-policys.

- `families` — tenant, ägare, plan-status
- `users` — förälder (Supabase auth-koppling) · `child_profiles` — alias, PIN-hash, ev. egen Strava
- `devices` — PC: namn, OS, parnings-token-hash, knuten till child_profile, senast sedd, revokerad?
- `earn_rules` — typ (strava/chore/bounty), enhet (per_km/per_run/fast), värde i min, dags-/veckotak, aktiv
- `chores` (mall) · `chore_completions` (vem, när, status: pending/approved/rejected)
- `ledger_entries` **(append-only)** — `family_id, child_id, delta_minutes, kind (earn/spend/adjust/clawback/bounty), source, created_at`. Saldo = `SUM(delta)` (cachead kolumn för snabb läsning).
- `tamper_events` — typ (kill/clock/network/admin/config), enhet, upptäckt när, bonus utbetald?, ev. barnets "writeup"
- `strava_connections` — krypterade access/refresh-tokens, athlete_id, scope
- `subscriptions` — stripe_customer_id, stripe_subscription_id, status, current_period_end, plan (spegel av Stripe via webhook)
- `audit_log` — vem gjorde vad (förtroende + spårbarhet)

Append-only-liggaren ger gratis historik, enkel claw-back och en sann revisionskedja.

## 5. Auth & roller
- **Förälder:** Supabase Auth — **Google först** (fas 1), senare Microsoft + användarnamn/lösen. Inga e-postlösen-flöden i fas 1.
- **Barn:** ingen e-post — förälder skapar profil med alias + PIN (eget begränsat login).
- **Agent:** loggar aldrig in som barnet — använder ett återkalleligt, scope:at *device token*.
- **Roller:** `owner` (full kontroll) vs `child` (läsa eget saldo, bocka sysslor). RLS på radnivå.

## 6. Intjäningsmotor (hjärtat)
- **Regelmotor:** föräldern definierar regler per familj; minuter med dags-/veckotak. Inga hårdkodade siffror.
- **Kredit:** Strava-runda (auto) eller godkänd syssla → `earn`. Tamper-bonus → `bounty`.
- **Debet:** agentens heartbeat rapporterar aktiv tid → `spend`.
- **Override:** förälder lägger `adjust` (+/–) med motivering.
- **Anti-fusk (Strava):** dagscap, sanity-gräns på pace (orimlig fart flaggas), claw-back om runda raderas/ändras, manuella aktiviteter exkluderas eller kräver godkännande.

### 6.1 Syssel-bibliotek, egna sysslor & AI-godkännande
- **Delat bibliotek** med sensible defaults (kategori, minuter, frekvens, ikon) — seed:as i fas 2.
- **Förälder & barn väljer från biblioteket och skapar egna** sysslor; belöningen ökas/minskas enkelt. Barn-skapade sysslor/belöningar kräver förälder-OK (ingen självbetjäning).
- **Godkännandelägen per syssla:** `auto` · `parent` · `ai`.
- **AI-godkänn (fotobevis):** barnet laddar upp t.ex. *före/efter* → Claude (vision) bedömer om sysslan är gjord. Hög konfidens → auto-kredit; osäkert → eskalera till förälder. Bilder i Supabase Storage; bevis + AI-utlåtande sparas för spårbarhet.

## 7. Windows-agenten
- **Form:** .NET 10 Worker Service som **LocalSystem** → icke-admin barnkonto kan ej stoppa den. Liten tray-app för status/varningar.
- **Parning:** förälder genererar 6-siffrig kod → matas in i agenten → byts mot device token (DPAPI-lagrat).
- **Tidräkning:** aktiv förgrundstid (ej idle/lås/sömn). Heartbeat ~30 s: rapporterar förbrukning, hämtar saldo + policy.
- **Verkställande:** varningar 10/5/1 min → `LockWorkStation` vid noll.
- **Offline-policy:** lokal saldocache + konfigurerbar grace-period så nätstrul ej låser orättvist; efter grace → fail-safe lås (förälderstyrt val).
- **Flera enheter/barn:** delad plånbok, servern = sanningskälla; en aktiv nedräkning åt gången.

### 7.1 Tamper → Bounty ("red team-läge")
- **Detektera:** dödad tjänst, ändrad klocka, blockerade nätanrop, ny lokal admin, redigerad config/cache. (Detektion behövs ändå för korrekt tidräkning.)
- **Respons:** bonusminuter (`bounty`-post) + notis till förälder — *inte* hårdare lås.
- **Anti-farming:** bonus per **unik teknik** (dedupe på tamper-typ; upprepning ger inget), dags-/veckotak, valfri "skriv hur du gjorde"-writeup för större bonus → CTF-loop.

## 8. Strava-integration
- Engångs-OAuth (scope `activity:read`), tokens krypterade, proaktiv refresh.
- En webhook-subscription → `activity create/update/delete` → mappa endast löpning (konfigurerbart) → kreditera enligt regel.
- Dedupe på `activity_id`; hantera update/delete (claw-back). Rate limits 100/15 min, 1000/dygn.

## 9. Subscriptions / Stripe
- Stripe Billing: Checkout (subscription) + Customer Portal + webhooks. 14 dagars trial via `trial_period_days`.
- **Sanningskälla = Stripe**, speglas till `subscriptions` via webhooks (`checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed`).
- **Gating:** funktioner låses på `status in (trialing, active)`. Dunning + reaktivering hanteras. Restricted keys, signerade webhooks. PCI sköts av Stripe.

## 10. Säkerhet & integritet
- Dataminimering: barn alias-only, ingen PII.
- Föräldern är kund/kontoinnehavare; tydlig integritetspolicy + samtycke vid barnprofil.
- RLS överallt (familj A ser aldrig familj B), krypterade tredjeparts-tokens, restricted Stripe-nycklar, signerade webhooks, audit-logg.
- Secrets i Vercel/Supabase env (aldrig i repo). EU-region på Supabase + DPA:er (Supabase/Vercel/Stripe).
- Export/radera-familj-flöden (dataportabilitet + radering).

## 11. Notifieringar & e-post
Resend för transaktionellt: verifiering, kvitton, **veckosammanfattning till föräldern** ("Felix: 3 rundor, 12 km, 4 sysslor, 210 min"). Tray-varningar via agenten. Web-push senare.

## 12. Observability & drift
Sentry (web + agent) · Vercel Analytics · strukturerade loggar · hälso-endpoint. Larm på webhook-fel & misslyckade betalningar.

## 13. CI/CD, miljöer, kodsignering
- Monorepo (pnpm workspaces): `apps/web` (Next.js) + `apps/agent` (.NET) + `packages/shared` (delade kontrakt/typer).
- Vercel: preview-deploy per PR, prod på `main`. Supabase-migrationer via CLI i GitHub Actions; branch = isolerad preview-miljö.
- Agent: GitHub Actions bygger & släpper via Velopack-feed. **Code signing uppskjutet** till launch.

## 14. Test
Enhetstester på regelmotorn · integrationstester på API + RLS (testa att familj A aldrig ser familj B) · Playwright e2e för onboarding/checkout · agenten testas på Windows-VM med simulerad tid.

## 15. Pris & go-to-market (kort)
- Förslag: en plan, **49 kr/mån/familj** (upp till t.ex. 4 barn / 5 enheter), 14 dagars trial, ev. årsrabatt.
- GTM: landningssida med "earn screen time"-pitch + demo-GIF av agenten som låser; föräldra-/skol-communities; Store-närvaro senare.

## 16. Roadmap (faser & milstolpar)
0. **Skelett** — monorepo, verktyg, plan, .gitignore. → *Repo står.*
1. **Fundament** — Supabase-schema + RLS, Next.js-skal, förälder-auth, familj/barnprofil. → *Logga in, skapa familj.*
2. **Kärnvärde** — regelmotor + plånbok/liggare, syssel-UI + godkännande, Strava OAuth + webhook. → *Saldo tickar av rundor & sysslor.*
3. **Agenten** — enhetsparning, heartbeat, nedräkning, lås, offline-policy, tamper→bounty. → **Skarp dogfooding med sonen.**
4. **Subscriptions** — Stripe Checkout/Portal/webhooks, gating, trial. → *Främlingar kan betala.*
5. **Polish & launch** — landningssida, onboarding, veckomejl, Sentry, kodsignering, integritetspolicy. → *Publik beta.*
6. **v1+** — fler plattformar, fler aktivitetskällor (Apple Health/Google Fit), syskontävlingar, belöningar utöver skärmtid.

## 17. Risker & öppna frågor
- Agent-tamper på djupet — vi siktar på avskräckning + bounty, inte total ointränglighet.
- Code-signing-cert kostar/tar tid — påverkar agentens launch-datum.
- Pris/paketering ej fastlåst — platshållare tills fas 4.
