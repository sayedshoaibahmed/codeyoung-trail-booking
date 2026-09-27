/**
 * Dummy / demo class link: Join Room uses the in-app /class/:bookingId route.
 * Production source must not point at meet.codeyoung.com.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const BACKEND_SRC = join(process.cwd(), 'src');
const REPO_ROOT = join(process.cwd(), '..');
const FRONTEND_SRC = join(REPO_ROOT, 'frontend', 'src');
const FORBIDDEN_HOST = 'meet.codeyoung.com';

function walkFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules' || name === 'dist') continue;
      walkFiles(full, acc);
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe('demo classroom link (Join Room)', () => {
  it('A/B — Join Room uses the internal /class/:bookingId path (booking UUID)', () => {
    const helper = readFileSync(join(FRONTEND_SRC, 'shared/lib/classRoomPath.ts'), 'utf8');
    expect(helper).toContain('`/class/${bookingId}`');

    const dashboard = readFileSync(join(FRONTEND_SRC, 'widgets/dashboard/ui/DashboardWidget.tsx'), 'utf8');
    expect(dashboard).toContain('classRoomPath(booking.id)');
    expect(dashboard).toContain('Join Room');
    expect(dashboard).not.toContain('booking.meetingLink');
    expect(dashboard).not.toContain(FORBIDDEN_HOST);
  });

  it('C/D — /class/:id is routed to ClassRoomPage (direct URL and in-app navigation)', () => {
    const app = readFileSync(join(FRONTEND_SRC, 'app/App.tsx'), 'utf8');
    expect(app).toMatch(/path=["']\/class\/:id["']/);
    expect(app).toContain('ClassRoomPage');

    const page = readFileSync(join(FRONTEND_SRC, 'pages/class-room/ui/ClassRoomPage.tsx'), 'utf8');
    expect(page).toContain("useParams<{ id: string }>()");
    expect(page).toContain('useBooking(id)');
    expect(page).toContain('Demo Class Room');
    expect(page).not.toContain(FORBIDDEN_HOST);
  });

  it('E — no active production source depends on meet.codeyoung.com', () => {
    const files = [...walkFiles(BACKEND_SRC), ...walkFiles(FRONTEND_SRC)];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (text.includes(FORBIDDEN_HOST)) {
        hits.push(relative(REPO_ROOT, file).replace(/\\/g, '/'));
      }
    }
    expect(hits).toEqual([]);
  });
});
