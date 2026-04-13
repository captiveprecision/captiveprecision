# Captive Precision Platform

Next.js platform for Captive Precision with:

- Supabase authentication and application profiles
- role-based workspaces for coach, gym, and admin
- Cheer Planner and My Teams planner data persisted in Supabase
- shared tool shell ready for future product surfaces
- internal membership/license structures kept provider-neutral

## Stack

- Next.js 15
- React 19
- TypeScript
- Supabase Auth + Postgres + RLS

## Billing Status

No billing provider is connected in this phase. The project keeps provider-neutral membership/license structures for future use. Stripe may be added later, but there is no active payment integration right now.

## First Steps

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
copy .env.example .env.local
```

Set `NEXT_PUBLIC_APP_URL` to the active environment URL. In production it should be `https://app.captiveprecision.com`.

3. Create the Supabase project and run migrations in order from `supabase/migrations`.

4. Start the project:

```bash
npm run dev
```

## Structure

- `app/`: App Router routes
- `components/`: shared and feature UI components
- `lib/`: clients, helpers, services, access rules, and domain contracts
- `supabase/migrations/`: SQL schema and incremental migrations
- `docs/`: architecture and setup notes

## Current Model

- `admin`
- `gym`
- `coach`
- `coach.membership_type`:
  - `independent`
  - `gym_assigned`
- gyms with coach licenses
- planner data persisted to Supabase
- scoring systems versioned for future tools

## Current Priorities

- keep Supabase as the source of truth for auth and planner data
- keep billing/provider integration disconnected until Stripe is intentionally scoped
- continue hardening coach, gym, and admin workflows without changing source-of-truth rules
