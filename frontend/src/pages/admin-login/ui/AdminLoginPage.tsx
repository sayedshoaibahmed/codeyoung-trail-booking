/**
 * pages/admin-login — admin session login. Credentials are posted to the API;
 * they are never stored in the frontend bundle.
 */
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { adminAuthApi } from '../../../features/admin-auth/api';
import { useAdminSession } from '../../../features/admin-auth/model/useAdminSession';
import { ApiError } from '../../../shared/api/base';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';

export function AdminLoginPage() {
  const session = useAdminSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (session === 'authenticated') {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await adminAuthApi.login(username.trim(), password);
      window.location.assign('/admin');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Invalid username or password.');
      } else {
        setError('Invalid username or password.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-2 min-h-16 py-3 items-center">
            <Link to="/" className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 shrink-0 bg-amber-500 rounded-lg flex items-center justify-center font-bold text-slate-900 shadow-sm">
                CY
              </div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-teal-900 truncate">
                CodeYoung
              </span>
            </Link>
            <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-teal-900 transition-colors whitespace-nowrap">
              ← Home
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8"
        >
          <h1 className="text-2xl font-extrabold text-teal-950 mb-1">Admin sign in</h1>
          <p className="text-sm text-slate-500 font-medium mb-6">
            Enter your admin username and password.
          </p>
          <label htmlFor="admin-username" className="block text-sm font-semibold text-slate-700 mb-1">
            Username
          </label>
          <Input
            id="admin-username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mb-4"
          />
          <label htmlFor="admin-password" className="block text-sm font-semibold text-slate-700 mb-1">
            Password
          </label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error || undefined}
          />
          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || session === 'loading'}
            className="mt-6 w-full h-12 rounded-xl"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>
      </main>
    </div>
  );
}
