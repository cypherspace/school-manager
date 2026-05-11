// Time engine. The school year runs September through July with three terms,
// each split by a half-term break. Weekends and holidays are non-teaching days
// (no incidents) but time still passes. ~190 teaching days per year.

export interface DayInfo {
  date: Date;
  iso: string;
  weekday: number; // 0 = Sunday
  isWeekend: boolean;
  inTerm: boolean;
  termLabel: "Autumn" | "Spring" | "Summer" | "Holiday";
  halfTerm: 1 | 2 | 3 | 4 | 5 | 6 | null;
  isReportingPoint: boolean;
  isTermBoundary: boolean;
  isYearEnd: boolean; // last teaching day of the school year (results day)
  schoolYearLabel: string; // "2026/27"
  schoolYearEnd: number; // 2027
}

export function startDate(schoolYearStart: number): Date {
  // Game starts on the first Monday of September of the school year.
  const d = new Date(Date.UTC(schoolYearStart, 8, 1));
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export function dateForDay(schoolYearStart: number, dayIndex: number): Date {
  const d = startDate(schoolYearStart);
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d;
}

// Term schedule. Fixed-ish term windows; reporting points fall at the end of
// each half-term. This is deliberately simple — we are not modelling
// jurisdiction-specific calendars.
interface TermSegment {
  termLabel: "Autumn" | "Spring" | "Summer";
  halfTerm: 1 | 2 | 3 | 4 | 5 | 6;
  startMonth: number; // 0-indexed
  startDay: number;
  endMonth: number;
  endDay: number;
}

const TERM_SEGMENTS: TermSegment[] = [
  { termLabel: "Autumn", halfTerm: 1, startMonth: 8, startDay: 1, endMonth: 9, endDay: 22 },
  { termLabel: "Autumn", halfTerm: 2, startMonth: 9, startDay: 30, endMonth: 11, endDay: 18 },
  { termLabel: "Spring", halfTerm: 3, startMonth: 0, startDay: 5, endMonth: 1, endDay: 11 },
  { termLabel: "Spring", halfTerm: 4, startMonth: 1, startDay: 20, endMonth: 2, endDay: 31 },
  { termLabel: "Summer", halfTerm: 5, startMonth: 3, startDay: 15, endMonth: 4, endDay: 24 },
  { termLabel: "Summer", halfTerm: 6, startMonth: 5, startDay: 2, endMonth: 6, endDay: 19 },
];

function inWindow(month: number, day: number, seg: TermSegment): boolean {
  const after = month > seg.startMonth || (month === seg.startMonth && day >= seg.startDay);
  const before = month < seg.endMonth || (month === seg.endMonth && day <= seg.endDay);
  return after && before;
}

export function dayInfo(schoolYearStart: number, dayIndex: number): DayInfo {
  const date = dateForDay(schoolYearStart, dayIndex);
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const weekday = date.getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;

  let termLabel: DayInfo["termLabel"] = "Holiday";
  let halfTerm: DayInfo["halfTerm"] = null;
  for (const seg of TERM_SEGMENTS) {
    if (inWindow(month, day, seg)) {
      termLabel = seg.termLabel;
      halfTerm = seg.halfTerm;
      break;
    }
  }
  const inTerm = !isWeekend && halfTerm !== null;

  // Reporting points: last teaching day of half-terms 2, 4, 6 (one per term).
  // Term boundaries: same days, also boundary into break.
  let isReportingPoint = false;
  let isTermBoundary = false;
  let isYearEnd = false;
  if (halfTerm !== null) {
    const seg = TERM_SEGMENTS.find((s) => s.halfTerm === halfTerm)!;
    if (month === seg.endMonth && day === seg.endDay) {
      isReportingPoint = halfTerm === 2 || halfTerm === 4 || halfTerm === 6;
      isTermBoundary = halfTerm === 2 || halfTerm === 4 || halfTerm === 6;
      isYearEnd = halfTerm === 6;
    }
  }

  // School year label: from Sept to August.
  const schoolYearEnd = month >= 8 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();
  const startY = schoolYearEnd - 1;
  const schoolYearLabel = `${startY}/${String(schoolYearEnd).slice(-2)}`;

  return {
    date,
    iso: date.toISOString().slice(0, 10),
    weekday,
    isWeekend,
    inTerm,
    termLabel,
    halfTerm,
    isReportingPoint,
    isTermBoundary,
    isYearEnd,
    schoolYearLabel,
    schoolYearEnd,
  };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// Day index of the year-end (last teaching day) for the school year that
// begins on schoolYearStart. Used to know when to roll over.
export function findYearEndDayIndex(schoolYearStart: number): number {
  for (let i = 0; i < 400; i++) {
    if (dayInfo(schoolYearStart, i).isYearEnd) return i;
  }
  throw new Error("could not locate year-end day");
}
