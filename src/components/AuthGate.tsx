import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

export function AuthGate() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Ingresa tu correo electrónico.');
      return;
    }

    setLoading(true);
    setError(null);
    setSentMessage(null);

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
      },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }

    setSentMessage(
      `Enviamos un enlace de acceso a ${cleanEmail}. Revisa tu bandeja y abre el enlace en este navegador.`,
    );
  }

  async function handleGoogleLogin() {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/admin`,
      },
    });

    if (authError) {
      setLoading(false);
      setError(authError.message);
    }
  }

  return (
    <main className="page-center">
      <section className="card auth-card">
        <p className="eyebrow">Panel privado</p>
        <h1>Administrar wishlists</h1>
        <p className="muted">
          Inicia sesión con tu correo para crear y editar tus listas de eventos.
        </p>

        <form onSubmit={handleMagicLink} className="stack">
          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Enviando...' : 'Enviar Magic Link'}
          </button>
        </form>

        <div className="divider">
          <span>o</span>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          Continuar con Google
        </button>

        {sentMessage && <p className="alert alert-success">{sentMessage}</p>}
        {error && <p className="alert alert-error">{error}</p>}
      </section>
    </main>
  );
}

