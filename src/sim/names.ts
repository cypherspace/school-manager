import type { RNG } from "./rng.ts";

// Mid-Atlantic generic names. Deliberately not UK-specific or US-specific,
// to match the "generic Western state/independent education" setting.

const FIRST_NAMES_F = [
  "Amelia", "Sophie", "Olivia", "Hannah", "Grace", "Lily", "Mia", "Chloe",
  "Ava", "Isla", "Freya", "Maya", "Ruby", "Ella", "Ivy", "Nora", "Elsie",
  "Daisy", "Rosie", "Imogen", "Alice", "Florence", "Esme", "Phoebe", "Beatrice",
  "Eleanor", "Iris", "Matilda", "Hazel", "Willow", "Clara", "Edith", "Martha",
  "Naomi", "Zara", "Anya", "Leila", "Yara", "Priya", "Aisha", "Fatima",
  "Sarah", "Rachel", "Hannah", "Rebecca", "Joanna", "Vanessa", "Theresa",
  "Carol", "Diane", "Linda", "Susan", "Patricia", "Margaret", "Janet",
];

const FIRST_NAMES_M = [
  "Oliver", "Noah", "George", "Arthur", "Leo", "Harry", "Charlie", "Jack",
  "Oscar", "Henry", "Theo", "Freddie", "Alfie", "Archie", "Thomas", "William",
  "Joshua", "James", "Edward", "Daniel", "Samuel", "Benjamin", "Sebastian",
  "Isaac", "Nathaniel", "Felix", "Hugo", "Rufus", "Otto", "Wilfred",
  "Mason", "Tyler", "Brandon", "Dylan", "Ethan", "Liam", "Logan", "Owen",
  "Reuben", "Elijah", "Kai", "Zayd", "Amir", "Ibrahim", "Mateo", "Diego",
  "David", "Michael", "Stephen", "Andrew", "Peter", "Paul", "Geoffrey",
  "Brian", "Colin", "Derek", "Malcolm", "Roger", "Nigel", "Trevor",
];

const SURNAMES = [
  "Ashworth", "Beckett", "Brennan", "Crawford", "Donovan", "Ellis", "Fairfax",
  "Greaves", "Hartley", "Holloway", "Ingram", "Kingsley", "Lambert", "Mercer",
  "Norris", "Oakley", "Pendle", "Quinn", "Radcliffe", "Sinclair", "Tremaine",
  "Upton", "Vaughn", "Wexley", "Yardley", "Zenobia",
  "Patel", "Khan", "Singh", "Kapoor", "Begum", "Iqbal", "Hassan", "Ahmed",
  "Nguyen", "Tran", "Park", "Choi", "Yamamoto",
  "García", "Rodríguez", "Hernández", "López", "Morales",
  "Smith", "Jones", "Brown", "Taylor", "Wilson", "Davies", "Evans", "Thomas",
  "Roberts", "Walker", "Wright", "Edwards", "Hughes", "Wood", "Bell", "Ward",
  "Cooper", "Harrison", "Clarke", "Webb", "Holland", "Marsh", "Slater",
  "Connolly", "Murphy", "O'Brien", "Kelly", "Doyle", "Whelan",
  "Reinhardt", "Schwab", "Kellner", "Voss",
  "Marković", "Novak", "Petrov", "Kowalski", "Nowak",
];

const SCHOOL_FIRSTS = [
  "Greenfield", "Ashbridge", "Holloway", "Marston", "Northgate", "Eastview",
  "Westwood", "Stonebrook", "Riverside", "Highfield", "Oakmere", "Beechwood",
  "Fairford", "Kingsmead", "Saint Olwen's", "Cromwell", "Pembury", "Linwell",
  "Carradine", "Tilbury", "Heatherden", "Whitstone", "Old Cathedral",
];

const SCHOOL_TYPES = [
  "Academy", "School", "High School", "College", "Community School",
  "Comprehensive", "Foundation School", "Free School",
];

const STREETS = [
  "Mill Lane", "Church Road", "Park Street", "Station Road", "Queen's Way",
  "Forge Hill", "Glebe Avenue", "Holly Walk", "Birch Crescent", "Vicarage Close",
];

const TOWNS = [
  "Eastmarsh", "Brindley", "Thorpefield", "Carrowby", "Hollanford", "Drayton",
  "Wickham Cross", "Salter's End", "Newhampton", "Old Furze",
];

export function femaleFirstName(rng: RNG): string {
  return rng.pick(FIRST_NAMES_F);
}

export function maleFirstName(rng: RNG): string {
  return rng.pick(FIRST_NAMES_M);
}

export function firstName(rng: RNG, sex: "f" | "m"): string {
  return sex === "f" ? femaleFirstName(rng) : maleFirstName(rng);
}

export function surname(rng: RNG): string {
  return rng.pick(SURNAMES);
}

export function fullName(rng: RNG, sex: "f" | "m"): string {
  return `${firstName(rng, sex)} ${surname(rng)}`;
}

export function schoolName(rng: RNG): string {
  return `${rng.pick(SCHOOL_FIRSTS)} ${rng.pick(SCHOOL_TYPES)}`;
}

export function townName(rng: RNG): string {
  return rng.pick(TOWNS);
}

export function streetAddress(rng: RNG): string {
  return `${rng.int(1, 220)} ${rng.pick(STREETS)}`;
}
