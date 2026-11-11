import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);

const FONTS = [
  {
    name: 'Inter',
    data: readFileSync(
      require.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'),
    ),
    weight: 400,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: readFileSync(
      require.resolve('@fontsource/inter/files/inter-latin-600-normal.woff'),
    ),
    weight: 600,
    style: 'normal',
  },
  {
    name: 'Inter',
    data: readFileSync(
      require.resolve('@fontsource/inter/files/inter-latin-700-normal.woff'),
    ),
    weight: 700,
    style: 'normal',
  },
];

const PRESET_THEMES = {
  classic: { bg: '#07080b', accent: '#0a84ff', surface: '#14161c' },
  warm: { bg: '#120f0c', accent: '#f59e0b', surface: '#1d1814' },
  festive: { bg: '#07110c', accent: '#30d158', surface: '#101c16' },
  editorial: { bg: '#0c0c0e', accent: '#e4e4e7', surface: '#17171a' },
};

function el(type, style, children) {
  return {
    type,
    props: {
      style,
      children,
    },
  };
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

  let title = 'Wishlist por evento';
  let hostName = '';
  let budgetText = null;
  let description =
    'Explora ideas de regalo, precios aproximados y enlaces directos.';
  let theme = PRESET_THEMES.classic;

  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (slug && supabaseUrl && supabaseKey) {
    try {
      const headers = {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      };
      const base = `${supabaseUrl}/rest/v1/lists?slug=eq.${encodeURIComponent(slug)}&limit=1`;
      let response = await fetch(
        `${base}&select=title,description,budget,currency,host_name,theme_preset`,
        { headers },
      );
      if (!response.ok) {
        response = await fetch(
          `${base}&select=title,description,budget,currency`,
          { headers },
        );
      }
      if (response.ok) {
        const rows = await response.json();
        const list = Array.isArray(rows) ? rows[0] : null;
        if (list?.title) {
          title = list.title;
          hostName = list.host_name?.trim() || '';
          budgetText = formatBudget(list.budget, list.currency);
          if (list.description?.trim()) {
            description = list.description.trim();
          }
          if (list.theme_preset && PRESET_THEMES[list.theme_preset]) {
            theme = PRESET_THEMES[list.theme_preset];
          }
        }
      }
    } catch {
      // Mantiene tarjeta por defecto si falla Supabase
    }
  }

  const accent = theme.accent;
  const badges = [];
  if (budgetText) {
    badges.push(
      el(
        'div',
        {
          display: 'flex',
          padding: '12px 22px',
          borderRadius: '999px',
          background: `${accent}26`,
          border: `1px solid ${accent}55`,
          color: accent,
          fontSize: '22px',
          fontWeight: 600,
        },
        `Presupuesto tope: ${budgetText}`,
      ),
    );
  }
  badges.push(
    el(
      'div',
      {
        display: 'flex',
        padding: '12px 22px',
        borderRadius: '999px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: '#d1d1d6',
        fontSize: '22px',
        fontWeight: 600,
      },
      slug ? `/l/${slug}` : 'wishlist.denogean.dev',
    ),
  );

  const tree = el(
    'div',
    {
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px',
      backgroundColor: theme.bg,
      backgroundImage: `radial-gradient(circle at 12% 10%, ${accent}33 0%, transparent 55%)`,
      color: '#f5f5f7',
      fontFamily: 'Inter',
    },
    [
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        [
          el(
            'div',
            {
              display: 'flex',
              padding: '10px 18px',
              borderRadius: '999px',
              background: theme.surface,
              border: '1px solid rgba(255,255,255,0.14)',
              color: accent,
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '0.06em',
            },
            hostName ? `LISTA DE ${hostName.toUpperCase()}` : 'LISTA DE REGALOS',
          ),
          el(
            'div',
            {
              display: 'flex',
              color: '#8e8e93',
              fontSize: '20px',
              fontWeight: 600,
            },
            'wishlist.denogean.dev',
          ),
        ],
      ),
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        },
        [
          el(
            'div',
            {
              display: 'flex',
              fontSize: title.length > 36 ? '54px' : '64px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#f5f5f7',
            },
            title,
          ),
          el(
            'div',
            {
              display: 'flex',
              fontSize: '26px',
              lineHeight: 1.38,
              color: '#98989d',
              maxWidth: '960px',
            },
            description.length > 130
              ? `${description.slice(0, 127)}...`
              : description,
          ),
        ],
      ),
      el(
        'div',
        {
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        },
        badges,
      ),
    ],
  );

  const svg = await satori(tree, {
    width: 1200,
    height: 630,
    fonts: FONTS,
  });

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  })
    .render()
    .asPng();

  res.setHeader('Content-Type', 'image/png');
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=86400',
  );
  res.status(200).send(Buffer.from(png));
}
