# Arquitectura inicial

## Objetivo

Preparar una base estable para una plataforma web en Next.js donde:

- el usuario crea o recupera su cuenta con Supabase Auth
- la plataforma recuerda su perfil e historial
- las herramientas premium se desbloquean por membresÃ­a activa en Whop
- cada herramienta puede guardar sus propios registros sin rediseÃ±ar la base cada vez

## Decisiones base

### 1. Auth desacoplado de billing

- `auth.users` es la fuente de identidad
- `public.profiles` guarda datos de producto y presentaciÃ³n
- Whop no reemplaza el login; Whop solo define acceso premium

Esto evita acoplar autenticaciÃ³n y pagos, y simplifica soporte, recuperaciÃ³n de cuenta y administraciÃ³n.

### 2. CatÃ¡logo de herramientas en base de datos

La tabla `public.tools` permite activar, ocultar, ordenar y tipificar herramientas sin tocar cÃ³digo de routing cada vez.

### 3. Registros genÃ©ricos por herramienta

La tabla `public.tool_records` guarda:

- `input_data`
- `output_data`
- `status`
- relaciÃ³n con usuario y herramienta

Con eso se cubren varias herramientas desde el inicio. Si una herramienta futura necesita alto volumen o estructura muy especÃ­fica, despuÃ©s se puede derivar a tablas especializadas.

### 4. MembresÃ­a y acceso

- `public.membership_plans` define planes comerciales
- `public.user_memberships` guarda el estado sincronizado desde Whop
- `public.tool_access_rules` decide quÃ© plan habilita quÃ© herramienta

La verificaciÃ³n real de acceso se concentra en la funciÃ³n SQL `user_has_tool_access`.

## Modelo de datos

### Identidad

- `auth.users`
- `public.profiles`

### Comercial

- `public.membership_plans`
- `public.user_memberships`
- `public.whop_webhook_events`

### Producto

- `public.tools`
- `public.tool_access_rules`
- `public.tool_records`

## Flujo sugerido

1. El usuario se registra o inicia sesiÃ³n con Supabase.
2. Se crea o actualiza `public.profiles`.
3. Whop envÃ­a un webhook cuando una membresÃ­a cambia.
4. El backend guarda el evento y sincroniza `public.user_memberships`.
5. Cuando el usuario intenta usar una herramienta, la app consulta si tiene acceso.
6. El uso de la herramienta queda guardado en `public.tool_records`.

## Pendientes de definiciÃ³n

- mÃ©todo exacto de login: magic link, email/password o social
- modelo comercial final en Whop: un plan Ãºnico o varios niveles
- si algunas herramientas gratis requieren tambiÃ©n guardar historial
- si habrÃ¡ equipos, coaches o cuentas multiusuario en una fase posterior
