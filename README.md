# Event Wishlists

Creador de wishlists personalizadas por evento. Organiza ideas de regalo para intercambios, Navidad o cumpleaños y compártelas con un enlace directo: el frontend corre con React y Vite, mientras Supabase resuelve la base de datos, la autenticación del dueño y las reglas de acceso.

Cualquier visitante entra al enlace de tu evento sin crear cuenta ni iniciar sesión. El sistema tampoco aparta regalos ni hace scraping de tiendas externas: cada producto conserva los datos y el enlace manual que tú definas.

## Qué ofrece el proyecto

- **Vista pública compartible (`/l/:slug`):** muestra el título del evento, emoji opcional, nota de bienvenida, fecha con cuenta regresiva y presupuesto tope. Cada tarjeta incluye tienda detectada desde la URL, precio aproximado, insignia de favorito, vista ampliada de imagen al tocarla y botón directo hacia el comercio.
- **Orden y presupuesto al instante:** cuando una lista incluye precios, quien visita puede ordenar de menor a mayor, de mayor a menor o filtrar solo los artículos dentro del presupuesto tope.
- **Panel privado (`/admin`):** acceso exclusivo por Magic Link enviado al correo. Desde ahí creas o editas eventos con slug personalizado, copias el enlace en un clic, descargas el código QR en formato SVG, destacas favoritos y reordenas productos a mano.
- **Privacidad en la raíz (`/`):** la página inicial se mantiene neutra y nunca expone tus listas activas; solo ofrece un acceso discreto al panel de administración.
- **Tema claro y oscuro global:** detecta la preferencia del sistema al cargar e incluye un selector flotante en todas las rutas.

## Stack técnico

- **Frontend:** React 19, TypeScript y Vite 6 con `react-router-dom`.
- **Backend:** Supabase (`@supabase/supabase-js`) con PostgreSQL, Supabase Auth (Magic Link) y Row Level Security.
- **Seguridad de datos:** lectura pública (`SELECT`) para visitantes en `lists` e `items`, mientras que `INSERT`, `UPDATE` y `DELETE` exigen `auth.uid() = user_id`.
- **Códigos QR:** `qrcode-generator` para construir el SVG directo en el navegador.

## 1. Configurar la base de datos en Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/).
2. Abre **SQL Editor** y ejecuta el archivo [`supabase/schema.sql`](supabase/schema.sql). Si ya tenías una versión previa, el script agrega de forma segura las columnas nuevas y recarga la caché del esquema.
3. En **Authentication → Providers**, confirma que **Email** esté activo para enviar enlaces Magic Link.
4. En **Authentication → URL Configuration**, registra `http://localhost:5173/admin` y tu ruta `/admin` de producción dentro de **Redirect URLs**.

## 2. Variables de entorno

Crea `.env` a partir de la plantilla de ejemplo:

```bash
cp .env.example .env
```

Completa ambos valores usando tus credenciales públicas de **Project Settings → API**:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

Usa solo la llave pública (`anon` o `publishable`). Vite empaqueta las variables con prefijo `VITE_` dentro del código cliente.

## 3. Ejecutar en local

```bash
npm install
npm start
```

Otros comandos disponibles:

- `npm test` — ejecuta las pruebas unitarias de formato, validación de URLs, slugs y cuenta regresiva.
- `npm run build` — verifica tipos con TypeScript y genera el paquete final en `dist/`.

## 4. Despliegue SPA

Las rutas `/l/:slug` y `/admin` requieren fallback hacia `index.html` cuando alguien recarga el navegador:

- **Vercel:** configurado en [`vercel.json`](vercel.json).
- **Cloudflare Pages:** configurado en [`public/_redirects`](public/_redirects) con `/* /index.html 200`.
