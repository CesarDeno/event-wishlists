# Event Wishlists

Aplicación web en React, TypeScript y Vite para gestionar listas personales de regalos por evento y compartirlas por enlace (`/l/:slug`) sin registro de visitantes.

## 1. Configurar la base de datos en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Abre **SQL Editor** en tu proyecto y ejecuta el contenido completo de [`supabase/schema.sql`](supabase/schema.sql).
3. En **Authentication → Providers**, verifica que **Email** esté habilitado para Magic Link.
4. En **Authentication → URL Configuration**, agrega `http://localhost:5173/admin` (y tu URL de producción en `/admin`) en **Redirect URLs**.

## 2. Configurar variables de entorno

Copia el archivo de ejemplo y coloca tus credenciales públicas de Supabase (**Project Settings → API**):

```bash
cp .env.example .env
```

Completa `.env`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

## 3. Levantar el proyecto en local

```bash
npm install
npm run dev
```

Rutas principales:
- `/` — pantalla mínima con enlace discreto al panel.
- `/admin` — panel privado autenticado para crear listas, copiar enlaces y gestionar productos.
- `/l/:slug` — vista pública compartible de solo lectura.

## 4. Despliegue SPA

- **Vercel**: usa [`vercel.json`](vercel.json) para redirigir todas las rutas a `/index.html`.
- **Cloudflare Pages**: usa [`public/_redirects`](public/_redirects) con el fallback `/* /index.html 200`.
