import { useParams, Link } from 'react-router-dom';
import { Button } from '../../../shared/ui/button';

export function ClassRoomPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">
      <div className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center text-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-amber-500 rounded flex items-center justify-center font-bold text-slate-900">
            CY
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">Live Classroom</h1>
        </div>
        <Link to={`/confirmation/${id}`} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
          Leave Class
        </Link>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-3xl w-full bg-slate-800 rounded-3xl p-12 text-center shadow-2xl border border-slate-700 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-amber-500" />
          <div className="inline-flex p-5 bg-slate-700 rounded-full mb-6 border-4 border-slate-600">
            <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-white mb-3">Mock Meeting Room</h2>
          <p className="text-slate-400 mb-10 text-lg leading-relaxed max-w-xl mx-auto">
            This is a simulated classroom environment for booking reference <strong className="text-slate-200">{id}</strong>.
            In a real scenario, this would be an interactive video call.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button variant="secondary" className="px-8 h-12 rounded-xl bg-slate-700 text-white hover:bg-slate-600 border-none">
              Mute Mic
            </Button>
            <Button variant="secondary" className="px-8 h-12 rounded-xl bg-slate-700 text-white hover:bg-slate-600 border-none">
              Stop Video
            </Button>
            <Link to={`/confirmation/${id}`}>
              <Button variant="destructive" className="px-8 h-12 rounded-xl font-bold bg-red-600 hover:bg-red-700">
                End Call
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
