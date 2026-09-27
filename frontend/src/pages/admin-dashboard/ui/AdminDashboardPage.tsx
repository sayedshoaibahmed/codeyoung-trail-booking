import { DashboardWidget } from '../../../widgets/dashboard/ui/DashboardWidget';
import { Link } from 'react-router-dom';

export function AdminDashboardPage() {
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
            <nav className="shrink-0">
              <Link to="/" className="text-sm font-semibold text-teal-700 hover:text-teal-900 transition-colors whitespace-nowrap">
                ← Booking
              </Link>
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
