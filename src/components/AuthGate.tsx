import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type AuthMode = 'login' | 'signup';

function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Correo o contraseña incorrectos.';
  }
  if (lower.includes('user already registered')) {
    return 'Ya existe una cuenta registrada con ese correo.';
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('rate limit')) {
    return 'Límite de correos de Supabase alcanzado (2/hora). Desactiva "Confirm email" en Supabase o espera 1 hora.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu correo aún no ha sido confirmado. Revisa tu bandeja de entrada.';
  }
  return message;
}

export function AuthGate() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setInfoMessage(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Ingresa tu correo electrónico y contraseña.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setError(null);
    setInfoMessage(null);

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      });

      setLoading(false);
      if (signUpError) {
        setError(formatAuthError(signUpError.message));
        return;
      }

      if (!data.session) {
        setInfoMessage(
          `Cuenta creada para ${cleanEmail}. Revisa tu correo para confirmarla antes de iniciar sesión.`,
        );
        setMode('login');
      }
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setLoading(false);
    if (authError) {
      setError(formatAuthError(authError.message));
    }
  }

  return (
    <main className="page-center">
      <section className="card auth-card">
        <p className="eyebrow">Panel privado</p>
        <h1>Administrar wishlists</h1>
        <p className="muted">
          {mode === 'login'
            ? 'Inicia sesión con tu correo y contraseña para editar tus listas.'
            : 'Crea una cuenta nueva para gestionar tus propias wishlists.'}
        </p>

        <div
          className="segmented-control"
          role="group"
          aria-label="Modo de acceso"
        >
          <button
            type="button"
            className={`segment-btn ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => switchMode('login')}
            disabled={loading}
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            className={`segment-btn ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => switchMode('signup')}
            disabled={loading}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stack">
          <label className="field">
            <span>Correo electrónico</span>
            <input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </label>

          <label className="field">
            <span>Contraseña</span>
            <input
              type="password"
              minLength={mode === 'signup' ? 6 : undefined}
              enterKeyHint="go"
              required
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              placeholder={
                mode === 'signup' ? 'Mínimo 6 caracteres' : 'Tu contraseña'
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </label>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? mode === 'signup'
                ? 'Creando cuenta...'
                : 'Entrando...'
              : mode === 'signup'
                ? 'Crear cuenta'
                : 'Iniciar sesión'}
          </button>
        </form>

        {infoMessage && <p className="alert alert-success">{infoMessage}</p>}
        {error && <p className="alert alert-error">{error}</p>}
      </section>
    </main>
  );
}
