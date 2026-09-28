import { DashboardWidget } from '../../../widgets/dashboard/ui/DashboardWidget';
import { Link, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { useAdminSession } from '../../../features/admin-auth/model/useAdminSession';
import { adminAuthApi } from '../../../features/admin-auth/api';
import { Button } from '../../../shared/ui/button';

export function AdminDashboardPage() {
  const session = useAdminSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (session === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-slate-500">
        Checking admin session…
      </div>
    );
  }

  if (session === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await adminAuthApi.logout();
    } finally {
      window.location.assign('/admin/login');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans text-slate-900 overflow-x-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-2 min-h-16 py-3 items-center">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 shrink-0 bg-teal-900 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">
                A
              </div>
              <h1 className="text-base sm:text-xl font-extrabold text-teal-950 tracking-tight truncate">CodeYoung Admin</h1>
            </div>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 shrink-0">
              <Link to="/" className="text-sm font-semibold text-teal-700 hover:text-teal-900 transition-colors whitespace-nowrap">
                ← Home
              </Link>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => { void handleLogout(); }}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Signing out…' : 'Logout'}
              </Button>
            </nav>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10">
        <div className="mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-teal-950">Dashboard</h2>
          <p className="text-base text-slate-500 mt-2 font-medium">Overview of today's classes and mentor loads.</p>
        </div>
        
        <DashboardWidget />
      </main>
    </div>
  );
}
