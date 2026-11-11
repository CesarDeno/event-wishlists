import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="page-center">
      <section className="card home-card">
        <h1>Wishlists por evento</h1>
        <p className="muted">
          Comparte listas de regalos mediante su enlace directo.
        </p>
        <Link to="/admin" className="discreet-link">
          Ir al panel privado
        </Link>
      </section>
    </main>
  );
}

