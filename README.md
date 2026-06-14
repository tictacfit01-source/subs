# Subs · control de suscripciones

Web app personal (mobile-first) para llevar el control de tus suscripciones: cuánto
gastas al mes, qué se renueva pronto y en qué se te va el dinero. Con login y datos
en **Supabase**. Portada del diseño de Claude Design (`Claude Design/Subs.dc.html`).

**Stack:** Vite + React 19 + Supabase (Auth con enlace mágico + Postgres con RLS).
Despliegue pensado para Vercel.

---

## 1. Instalar dependencias

```bash
npm install
```

## 2. Crear el proyecto de Supabase

1. Entra en https://supabase.com/dashboard → **New project** (nombre p. ej. `subs`,
   elige región Europa, guarda la contraseña de la base de datos).
2. Cuando termine de aprovisionarse, ve a **SQL Editor** → **New query**, pega el
   contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.
   Eso crea la tabla `subscriptions` con su Row Level Security (cada usuario solo ve
   lo suyo).

## 3. Configurar el login (enlace mágico)

En Supabase → **Authentication**:
- **Providers → Email**: debe estar habilitado (lo está por defecto). El enlace
  mágico funciona sin contraseña.
- **URL Configuration**:
  - *Site URL*: `http://localhost:5173` (en desarrollo) y luego tu dominio de Vercel.
  - *Redirect URLs*: añade `http://localhost:5173` y tu URL de Vercel.
- (Opcional, al ser una app personal) cuando hayas entrado por primera vez, puedes
  desactivar **Allow new users to sign up** para que nadie más pueda registrarse.

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

Abre http://localhost:5173, mete tu correo, abre el enlace mágico que recibas y entra.
La primera vez verás el estado vacío: pulsa **"cargar datos de ejemplo"** (o Ajustes →
Cargar datos de ejemplo) para añadir 8 suscripciones demo.

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
  auth/Login.jsx      acceso con enlace mágico
  SubsApp.jsx         app principal: panel, stats, detalle, ajustes, estado vacío, sheet
  lib/
    format.js         helpers (coste mensual, fechas, formato €, categorías, FX)
    charts.jsx        donut, sparkline y barras (SVG)
    supabase.js       cliente + CRUD + datos de ejemplo
supabase/schema.sql   tabla + RLS para ejecutar en tu proyecto
Claude Design/        el prototipo original (referencia)
```

## Siguientes pasos (ideas)

- **Calendario** de cobros (quedó fuera del alcance inicial).
- **Diseño de escritorio** a dos columnas con barra lateral.
- **Histórico real** de gasto mes a mes (ahora la evolución es ilustrativa).
- **Avisos por email** antes de cada renovación / fin de prueba (cron job en Vercel).
