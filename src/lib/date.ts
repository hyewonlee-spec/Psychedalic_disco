export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDue(date?: string) {
  if (!date) return false;
  return date <= todayIso();
}
