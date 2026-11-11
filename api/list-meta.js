const DEFAULT_TITLE = 'Wishlist - Cesar Denogean';
const DEFAULT_DESCRIPTION =
  'Listas de regalos por evento con presupuesto tope, precios aproximados y enlaces directos.';
const DEFAULT_IMAGE = 'https://wishlist.denogean.dev/og-image.png';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatBudget(budget, currency) {
  if (budget === null || budget === undefined) return null;
  const num = Number(budget);
  if (!Number.isFinite(num)) return null;
  const code = (currency || 'MXN').trim().toUpperCase();
  try {
    const formatted = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: Number.isInteger(num) ? 0 : 2,
    }).format(num);
    return `${formatted} ${code}`;
  } catch {
    return `${num} ${code}`;
  }
}

export default async function handler(req, res) {
  const slug = typeof req.query?.slug === 'string' ? req.query.slug.trim() : '';
  const origin = req.headers.host
    ? `https://${req.headers.host}`
    : 'https://wishlist.denogean.dev';

  let title = DEFAULT_TITLE;
  let description = DEFAULT_DESCRIPTION;
  const pageUrl = slug ? `${origin}/l/${encodeURIComponent(slug)}` : origin;
  const imageUrl = `${origin}/og-image.png`;

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (slug && supabaseUrl && supabaseKey) {
    try {
      const endpoint = `${supabaseUrl}/rest/v1/lists?slug=eq.${encodeURIComponent(
        slug,
      )}&select=title,description,budget,currency,emoji&limit=1`;
      const response = await fetch(endpoint, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (response.ok) {
        const rows = await response.json();
        const list = Array.isArray(rows) ? rows[0] : null;
        if (list?.title) {
          title = `${list.emoji ? `${list.emoji} ` : ''}${list.title} — Wishlist`;
          const budget = formatBudget(list.budget, list.currency);
          const parts = [
            list.description?.trim() || null,
            budget ? `Presupuesto tope: ${budget}` : null,
            'Explora ideas de regalo y enlaces directos.',
          ].filter(Boolean);
          description = parts.join(' · ');
        }
      }
    } catch {
      // Mantiene metadatos por defecto si falla la consulta
    }
  }

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeUrl = escapeHtml(pageUrl);
  const safeImage = escapeHtml(imageUrl || DEFAULT_IMAGE);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle}</title>
    <meta name="description" content="${safeDescription}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="es_MX" />
    <meta property="og:site_name" content="${escapeHtml(DEFAULT_TITLE)}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
  </head>
  <body></body>
</html>`);
}

