# Setup Checklist

## GitHub

- initialize the Git repository
- create `.env.local` from `.env.example`
- commit the project baseline

## Supabase

- create the Supabase project
- enable Auth
- run all files in `supabase/migrations` in order
- configure URL and keys in `.env.local` and production hosting

## Application

- install dependencies
- run `npm run dev`
- test `/api/health`
- test real login, logout, workspace selection, and protected routes
- verify planner data persists in Supabase after refresh

## Billing

- no billing provider is connected in this phase
- do not configure any billing provider
- do not configure Stripe until a dedicated billing integration phase is opened
