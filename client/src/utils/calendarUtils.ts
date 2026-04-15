export function buildMonthGroups() {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // local midnight
  const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD in local tz

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const date = d.toLocaleDateString('en-CA');
    days.push({
      date,
      dayOfMonth: d.getDate(),
      dayOfWeek: d.getDay(),
      month: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      monthYear: `${d.getFullYear()}-${d.getMonth()}`,
      isToday: date === todayStr,
    });
  }

  const groups: Record<string, typeof days> = {};
  days.forEach(d => { (groups[d.month] ??= []).push(d); });

  return Object.keys(groups).map(month => {
    const monthDays = groups[month];
    const first = monthDays[0];
    const last = monthDays[monthDays.length - 1];
    const firstDow = first.dayOfWeek === 0 ? 6 : first.dayOfWeek - 1;
    const lastDow = last.dayOfWeek === 0 ? 6 : last.dayOfWeek - 1;
    const [year, monthIdx] = last.monthYear.split('-').map(Number);
    const lastDayOfMonth = new Date(year, monthIdx + 1, 0).getDate();

    const padded: Array<{ type: string; dayOfMonth?: number; date?: string; isToday?: boolean }> = [];
    for (let i = 0; i < firstDow; i++) {
      const n = first.dayOfMonth - firstDow + i;
      padded.push(n > 0 ? { type: 'disabled', dayOfMonth: n } : { type: 'empty' });
    }
    padded.push(...monthDays.map(d => ({ type: 'active', ...d })));
    for (let i = lastDow + 1; i < 7; i++) {
      const n = last.dayOfMonth + (i - lastDow);
      padded.push(n <= lastDayOfMonth ? { type: 'disabled', dayOfMonth: n } : { type: 'empty' });
    }
    return { month, days: padded };
  });
}
