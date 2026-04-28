import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, hydrated, hydrate } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    if (hydrated && !token) {
      navigate('/login', { replace: true });
    }
  }, [hydrated, token, navigate]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-400">
        Loading...
      </div>
    );
  }

  if (!token) return null;

  return <>{children}</>;
}
