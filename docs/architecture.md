# Architecture

## Goal

Maintain a stable Next.js platform where:

- Supabase Auth owns user credentials
- `public.profiles` owns application profile and role data
- planner data is persisted in Supabase as the source of truth
- feature surfaces can grow without redefining domain entities or duplicating storage

## Base Decisions

### 1. Auth Is Separate From Billing

- `auth.users` is the identity source
- `public.profiles` stores product profile, role, and presentation data
- no billing provider is connected in this phase
- future billing should be integrated through a dedicated provider-neutral boundary

This keeps login, account recovery, support, and authorization independent from payment decisions.

### 2. Tool Catalog In Database

`public.tools` can activate, hide, order, and classify tool surfaces without changing routes every time.

### 3. Generic Tool Records

`public.tool_records` stores:

- `input_data`
- `output_data`
- `status`
- user and tool relationships

This supports simple tool history while allowing future high-volume tools to move to specialized tables later.

### 4. Provider-Neutral Membership Structures

The schema keeps neutral membership and license structures:

- `public.membership_plans`
- `public.user_memberships`
- `public.tool_access_rules`
- `public.gym_coach_licenses`

These are not connected to a payment provider right now. Stripe can be scoped later without reintroducing provider-specific assumptions into the core app.

## Data Model

### Identity

- `auth.users`
- `public.profiles`

### Commercial / Access Readiness

- `public.membership_plans`
- `public.user_memberships`
- `public.tool_access_rules`
- `public.gym_coach_licenses`

### Product

- `public.tools`
- `public.tool_records`
- planner tables in `supabase/migrations/006_planner_remote_persistence.sql`

## Current Flow

1. User signs up or logs in with Supabase.
2. The app creates or loads `public.profiles`.
3. Runtime authorization derives effective workspaces from `profiles.role`.
4. Planner and team data are loaded from Supabase.
5. Feature-specific save actions persist to Supabase and then refresh local state.

## Deferred Decisions

- Stripe billing model and checkout flow
- plan tiers and entitlement rules
- whether free tools require persisted history
- deeper organization-level membership administration
