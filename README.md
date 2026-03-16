# Captive Precision Platform

Base inicial para una plataforma web en Next.js con:

- autenticacion y perfiles en Supabase
- control de acceso premium por membresia via Whop
- registro generico de actividad por herramienta
- App Router listo para crecer a dashboard, onboarding y herramientas premium

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

3. Crea el proyecto en Supabase y ejecuta la migracion inicial en `supabase/migrations/001_initial_schema.sql`.

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

## Pendientes para la siguiente fase

- configurar login/signup real con UI
- verificar webhooks de Whop y sincronizar membresias
- construir la primera herramienta premium
- definir planes y reglas exactas de acceso por herramienta
