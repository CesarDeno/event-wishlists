import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeToggle } from './components/ThemeToggle';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { PublicListPage } from './pages/PublicListPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/l/:slug" element={<PublicListPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ThemeToggle />
    </BrowserRouter>
  );
}

