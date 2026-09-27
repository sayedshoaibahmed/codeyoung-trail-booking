import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 relative font-sans text-slate-900 overflow-x-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-2 min-h-16 py-3 items-center">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-8 h-8 shrink-0 bg-amber-500 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">
                CY
              </div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-teal-900 truncate">
                CodeYoung
              </span>
            </div>
            <nav className="shrink-0">
              <Link
                to="/book"
                className="inline-flex items-center justify-center rounded-xl text-sm font-bold bg-amber-500 text-slate-900 hover:bg-amber-600 shadow-sm h-10 px-4 whitespace-nowrap"
              >
                Book a FREE Trial
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-24">
        <div className="text-center min-w-0">
          <div className="inline-flex items-center rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 mb-6 shadow-sm">
            ✨ Free 1-Hour Trial
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-teal-950 tracking-tight leading-tight mb-6 break-words">
            Book a FREE Trial Class
          </h1>
          <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed">
            Give your child a fun, interactive 1-on-1 learning experience with an expert mentor.
          </p>
          <Link
            to="/book"
            className="inline-flex items-center justify-center w-full sm:w-auto whitespace-nowrap rounded-xl text-base font-bold transition-colors bg-amber-500 text-slate-900 hover:bg-amber-600 shadow-sm h-14 px-8"
          >
            Book a FREE Trial Class →
          </Link>
          <ul className="mt-10 space-y-3 text-slate-700 font-medium text-left max-w-md mx-auto">
            <li className="flex items-start">
              <span className="text-green-500 mr-3 shrink-0">✓</span>
              <span>1-on-1 live session</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 shrink-0">✓</span>
              <span>Expert mentor</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-3 shrink-0">✓</span>
              <span>Flexible scheduling</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
