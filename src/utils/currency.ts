export function formatCedis(value: number | string | null | undefined): string {
  const amount = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(amount)) {
    return '-';
  }
  return `₵${amount.toFixed(2)}`;
}
