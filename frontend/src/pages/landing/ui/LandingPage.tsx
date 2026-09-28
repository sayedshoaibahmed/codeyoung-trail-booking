import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import heroStudy from './hero-study.webp';

const benefits = [
  {
    title: '1-on-1 Learning',
    body: 'Personalized attention in a live session.',
  },
  {
    title: 'Expert Mentor',
    body: 'Learn directly with a dedicated mentor.',
  },
  {
    title: 'Flexible Scheduling',
    body: 'Choose a convenient available time.',
  },
] as const;

const steps = [
  { n: '01', title: 'Choose a date' },
  { n: '02', title: 'Pick a convenient time' },
  { n: '03', title: 'Enter your details' },
  { n: '04', title: 'Meet your mentor' },
] as const;

const ctaClass =
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl font-bold bg-amber-500 text-slate-900 hover:bg-amber-600 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-800 focus-visible:ring-offset-2';

function HeroScene() {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      <div className="pointer-events-none absolute -left-4 top-8 h-24 w-24 rounded-full bg-amber-100" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-2 bottom-6 h-16 w-16 rounded-full bg-teal-100" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-[1.75rem] bg-[#f4efe4] shadow-md">
        <img
          src={heroStudy}
          alt="A child with headphones studying at a laptop, with coding, math, science, robotics, and creative learning nearby"
          className="block h-auto w-full"
          width={1100}
          height={733}
        />
      </div>
    </div>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const root = headerRef.current;
      if (root && !root.contains(event.target as Node)) setMenuOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[#f7f6f3] font-sans text-slate-900 overflow-x-hidden">
      <header
        ref={headerRef}
        className="bg-white/95 border-b border-slate-200/80 shadow-sm sticky top-0 z-20 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-x-3 min-h-[4.25rem] py-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 shrink-0 bg-amber-500 rounded-xl flex items-center justify-center font-extrabold text-sm text-slate-900 shadow-sm">
                CY
              </div>
              <span className="text-lg md:text-xl font-extrabold tracking-tight text-teal-950 whitespace-nowrap">
                CodeYoung
              </span>
            </div>
            <nav
              className="hidden md:flex items-center justify-end gap-x-4 shrink-0"
              aria-label="Primary"
            >
              <Link
                to="/admin"
                className="text-sm font-semibold text-teal-700 hover:text-teal-900 transition-colors whitespace-nowrap"
              >
                Admin Dashboard
              </Link>
              <Link to="/book" className={`${ctaClass} h-10 px-4 text-sm`}>
                Book a FREE Trial
              </Link>
            </nav>
            <button
              type="button"
              className="md:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-teal-950 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-800 focus-visible:ring-offset-2"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.25} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
          </div>
          {menuOpen && (
            <nav id={menuId} className="md:hidden pb-4 min-w-0" aria-label="Mobile">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-md">
                <Link
                  to="/admin"
                  className="flex min-h-12 items-center rounded-xl px-4 text-sm font-semibold text-teal-800 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-800"
                  onClick={() => setMenuOpen(false)}
                >
                  Admin Dashboard
                </Link>
                <Link
                  to="/book"
                  className={`${ctaClass} mt-2 h-12 w-full px-4 text-sm`}
                  onClick={() => setMenuOpen(false)}
                >
                  Book a FREE Trial
                </Link>
              </div>
            </nav>
          )}
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-12 sm:pt-14 lg:pt-16 lg:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
            <div className="text-center lg:text-left min-w-0">
              <p className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 mb-5">
                ✨ Free 1-Hour Trial
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-teal-950 tracking-tight leading-[1.1] mb-5">
                Book a FREE Trial Class
              </h1>
              <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Give your child a fun, interactive 1-on-1 learning experience with an expert mentor.
              </p>
              <p className="text-base sm:text-lg text-slate-600 mb-8 leading-relaxed max-w-xl mx-auto lg:mx-0">
                Bookings must be made at least 2 hours in advance.
              </p>
              <Link to="/book" className={`${ctaClass} h-14 px-8 text-base w-full sm:w-auto`}>
                Book a FREE Trial Class →
              </Link>
            </div>
            <HeroScene />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-14" aria-labelledby="why-trial">
          <h2 id="why-trial" className="text-2xl sm:text-3xl font-extrabold text-teal-950 text-center mb-8">
            Why try a FREE trial class?
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {benefits.map((item) => (
              <li key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-bold text-teal-950 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="text-2xl sm:text-3xl font-extrabold text-teal-950 text-center mb-8">
            How it works
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <li key={step.n} className="rounded-2xl bg-white border border-slate-200 px-4 py-5 shadow-sm">
                <p className="text-sm font-bold text-amber-700 mb-1">{step.n}</p>
                <p className="font-semibold text-teal-950">{step.title}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Link to="/book" className={`${ctaClass} h-12 px-6 text-base`}>
              Start Your FREE Trial →
            </Link>
          </div>
        </section>

        <section className="px-4 sm:px-6 lg:px-8 pb-16">
          <div className="max-w-4xl mx-auto rounded-3xl bg-teal-950 text-center px-6 py-10 sm:px-10 sm:py-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
              Ready to try a FREE class?
            </h2>
            <p className="text-teal-100 mb-7">
              Give your child a chance to experience 1-on-1 learning.
            </p>
            <Link to="/book" className={`${ctaClass} h-14 px-8 text-base w-full sm:w-auto`}>
              Book a FREE Trial Class →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
