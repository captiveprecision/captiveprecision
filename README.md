# Captive Precision Platform

Base inicial para una plataforma web en Next.js con:

- autenticacion y perfiles en Supabase
- control de acceso premium por membresia via Whop
- registro generico de actividad por herramienta
- App Router listo para crecer a dashboard, onboarding y herramientas premium
- roles preparados para coach, gym y admin

## Stack base

- Next.js 15
- React 19
- TypeScript
- Supabase Auth + Postgres + RLS
- Integracion futura con Whop por webhooks

## Primeros pasos

1. Instala dependencias:

```bash
npm install
```

2. Copia variables de entorno:

```bash
copy .env.example .env.local
```

   Ajusta `NEXT_PUBLIC_APP_URL` al dominio activo del entorno. En produccion debe ser `https://app.captiveprecision.com`.

3. Crea el proyecto en Supabase y ejecuta las migraciones en orden:
- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_roles_gym_scoring.sql`

4. Inicia el proyecto:

```bash
npm run dev
```

## Estructura

- `app/`: rutas App Router
- `components/`: componentes compartidos
- `lib/`: clientes, helpers y reglas de acceso
- `supabase/migrations/`: esquema SQL inicial
- `docs/`: decisiones de arquitectura y siguientes pasos

## Modelo preparado

- `admin`
- `gym`
- `coach`
- `coach.membership_type`:
  - `independent`
  - `gym_assigned`
- `gym` con licencias de coaches
- scoring systems versionados para herramientas futuras

## Pendientes para la siguiente fase

- aplicar las migraciones en Supabase
- configurar login/signup real con UI
- persistir scoring systems desde Supabase en vez de localStorage
- verificar webhooks de Whop y sincronizar membresias
- construir permisos reales por rol y por licencia

