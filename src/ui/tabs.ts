// Two-level tab state, shared across views so any handler can navigate.

export type TopTab =
  | "inbox"
  | "timetable"
  | "discipline"
  | "staff"
  | "pupils"
  | "results"
  | "career"
  | "governors"
  | "extra";

export type SubTab = string;

export interface TabState {
  top: TopTab;
  sub: Record<TopTab, SubTab>;
}

export const tabState: TabState = {
  top: "inbox",
  sub: {
    inbox: "",
    timetable: "sets",
    discipline: "policy",
    staff: "roster",
    pupils: "roster",
    results: "latest",
    career: "cv",
    governors: "",
    extra: "",
  },
};

export const TOP_TABS: Array<{ key: TopTab; label: string }> = [
  { key: "inbox", label: "Inbox" },
  { key: "timetable", label: "Timetable" },
  { key: "discipline", label: "Discipline" },
  { key: "staff", label: "Staff" },
  { key: "pupils", label: "Pupils" },
  { key: "results", label: "Results" },
  { key: "career", label: "Career" },
  { key: "governors", label: "Governors" },
  { key: "extra", label: "Extra-curricular" },
];

// Tabs visible when the player is unemployed — only Career.
export const UNEMPLOYED_TABS: Array<{ key: TopTab; label: string }> = [
  { key: "career", label: "Career" },
];

export const SUB_TABS: Record<TopTab, Array<{ key: SubTab; label: string }>> = {
  inbox: [],
  timetable: [
    { key: "sets", label: "Sets" },
    { key: "allocations", label: "Staff allocations" },
    { key: "break", label: "Break duties" },
    { key: "lunch", label: "Lunch duties" },
  ],
  discipline: [{ key: "policy", label: "Policy" }],
  staff: [
    { key: "roster", label: "Roster" },
    { key: "leadership", label: "Leadership" },
  ],
  pupils: [{ key: "roster", label: "Roster" }],
  results: [
    { key: "latest", label: "Latest" },
    { key: "history", label: "History" },
  ],
  career: [
    { key: "cv", label: "CV" },
    { key: "sector", label: "Sector" },
    { key: "vacancies", label: "Vacancies" },
    { key: "applications", label: "Applications" },
    { key: "interview", label: "Interview" },
    { key: "former", label: "Former school" },
  ],
  governors: [],
  extra: [],
};
