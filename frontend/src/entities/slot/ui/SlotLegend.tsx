export function SlotLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
      <li>🟢 Available</li>
      <li>⚪ Unavailable</li>
      <li>🟡 Selected</li>
    </ul>
  );
}
