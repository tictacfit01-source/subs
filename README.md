# Subs · control de suscripciones

Web app (mobile-first) **multiusuario** para controlar suscripciones: cuánto gastas al
mes, qué se renueva pronto y en qué se te va el dinero. Cualquiera puede registrarse con
su correo y **cada usuario ve solo sus datos** (aislamiento por RLS en Supabase). Portada
del diseño de Claude Design (`Claude Design/Subs.dc.html`).

**Stack:** Vite + React 19 + Supabase (Auth con correo y contraseña + Postgres con RLS).
Despliegue pensado para Vercel.

---

## 1. Instalar dependencias

```bash
npm install
```

> Nota: `xlsx` se instala desde el CDN oficial de SheetJS (la versión publicada en npm
> está abandonada en 0.18.5 y tiene vulnerabilidades conocidas sin arreglo).

## 2. Crear el proyecto de Supabase

1. Entra en https://supabase.com/dashboard → **New project** (nombre p. ej. `subs`,
   elige región Europa, guarda la contraseña de la base de datos).
2. Cuando termine de aprovisionarse, ve a **SQL Editor** → **New query**, pega el
   contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
   Eso crea la tabla `subscriptions` con su Row Level Security (cada usuario solo ve
   lo suyo).

## 3. Configurar el login

La app usa **correo + contraseña**, con recuperación de contraseña por email
("¿Has olvidado tu contraseña?"). En Supabase → **Authentication**:
- **Providers → Email**: debe estar habilitado (lo está por defecto).
- **URL Configuration** (necesaria para que funcionen los enlaces de recuperación):
  - *Site URL*: `http://localhost:5173` (en desarrollo) y luego tu dominio de Vercel.
  - *Redirect URLs*: añade `http://localhost:5173` y tu URL de Vercel.
- **Allow new users to sign up**: déjalo **activado** (registro abierto) para que pueda
  entrar cualquiera con su correo. Cada usuario solo ve sus propias suscripciones (RLS).
- **Email para producción**: el envío de correos por defecto de Supabase está muy limitado
  (pocos correos/hora) y no sirve para una app pública real. Para uso público de verdad,
  configura un SMTP propio en Authentication → Emails (p. ej. Resend, SendGrid o Postmark).
  Opcional pero recomendable: añadir también **Google** como proveedor para un login en 1 clic.

## 4. Variables de entorno

Copia `.env.example` a `.env` y rellena con tus claves
(Supabase → **Project Settings → API**):

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key
```

> La `anon key` es pública (va en el frontend); la seguridad la da el RLS. **Nunca**
> pongas aquí la `service_role`.

## 5. Arrancar en local

```bash
npm run dev
```

Abre http://localhost:5173, crea una cuenta con tu correo y una contraseña y entra.
La primera vez verás el estado vacío: pulsa **"+ Añadir suscripción"** para empezar.

## 6. Desplegar en Vercel

1. Sube el proyecto a un repo de GitHub.
2. En Vercel → **New Project** → importa el repo. Framework: **Vite** (autodetectado).
3. En **Environment Variables** añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. Deploy. Luego añade la URL de Vercel en Supabase → Authentication → URL Configuration
   (Site URL + Redirect URLs).

---

## Estructura

```
src/
  main.jsx            punto de entrada
  index.css           tema (variables CSS portadas del diseño) + keyframes
  App.jsx             sesión de Supabase → Login o la app; tema claro/oscuro
  auth/Login.jsx      acceso con correo y contraseña + recuperación
  SubsApp.jsx         app principal: panel, stats, calendario, detalle, ajustes, sheet
  lib/
    format.js         helpers (coste mensual, fechas, formato €, categorías, FX)
    charts.jsx        donut, sparkline y barras (SVG)
    supabase.js       cliente + CRUD
    exportExcel.js    exportación a .xlsx (se carga bajo demanda)
supabase/schema.sql   tabla + RLS para ejecutar en tu proyecto
Claude Design/        el prototipo original (referencia)
```

## Siguientes pasos (ideas)

- **Diseño de escritorio** a dos columnas con barra lateral.
- **Histórico real** de gasto mes a mes.
- **Avisos por email** antes de cada renovación / fin de prueba (cron job en Vercel).
