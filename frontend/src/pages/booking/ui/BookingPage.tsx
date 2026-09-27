import { BookingFormWidget } from '../../../widgets/booking-form/ui/BookingFormWidget';
import { Link } from 'react-router-dom';

export function BookingPage() {
  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">
                CY
              </div>
              <span className="text-xl font-extrabold tracking-tight text-teal-900">
                CodeYoung
              </span>
            </div>
            <nav>
              <Link to="/admin" className="text-sm font-semibold text-teal-700 hover:text-teal-900 transition-colors">
                Admin Area →
              </Link>
            </nav>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          <div className="lg:col-span-5 lg:sticky lg:top-32">
            <div className="inline-flex items-center rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 mb-6 shadow-sm">
              ✨ Free 1-Hour Trial
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-teal-950 tracking-tight leading-tight mb-6">
              Unlock Your Child's Coding Potential
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Book a free 1-on-1 trial class with an expert mentor. They'll build their first project today and learn the fundamentals of computer science in a fun, engaging environment.
            </p>
            <ul className="space-y-4 text-slate-700 font-medium">
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span> Expert curriculum tailored for kids
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span> 1-on-1 live interactive sessions
              </li>
              <li className="flex items-center">
                <span className="text-green-500 mr-3">✓</span> Flexible timing to suit your schedule
              </li>
            </ul>
          </div>
          
          <div className="lg:col-span-7 bg-white p-6 sm:p-10 rounded-2xl shadow-xl border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-amber-500" />
            <BookingFormWidget />
          </div>
        </div>
      </main>
    </div>
  );
}
