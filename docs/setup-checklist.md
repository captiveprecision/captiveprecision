# Checklist de setup

## GitHub

- inicializar repositorio Git
- crear `.env.local` a partir de `.env.example`
- hacer primer commit con la base del proyecto

## Supabase

- crear proyecto
- habilitar Auth
- ejecutar `supabase/migrations/001_initial_schema.sql`
- configurar URL y keys en `.env.local`

## Whop

- crear producto o membresÃ­a
- registrar `external_product_id` en `membership_plans`
- configurar webhook hacia `/api/webhooks/whop`
- guardar `WHOP_WEBHOOK_SECRET`

## AplicaciÃ³n

- instalar dependencias
- levantar `npm run dev`
- probar `/api/health`
- probar login real y sincronizaciÃ³n de membresÃ­a en la siguiente fase
