export function normalizeCancellationToken(value: string): string {
  return value.replace(/\s+/g, '');
}
