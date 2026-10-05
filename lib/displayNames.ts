const adjectives = [
  'Diya', 'Garba', 'Dandiya', 'Navratri', 'Raas', 'Aarti', 'Bhavani',
  'Chaniya', 'Taali', 'Dhol', 'Kesar', 'Rangoli', 'Mehndi', 'Ghoomar',
];

const names = [
  'Avni', 'Riya', 'Arjun', 'Karan', 'Meera', 'Dev', 'Nisha', 'Yash',
  'Isha', 'Kavya', 'Rohan', 'Tara', 'Vihaan', 'Anaya', 'Kabir', 'Diya',
  'Aarav', 'Saanvi', 'Neel', 'Pari', 'Jay', 'Krupa', 'Hetal', 'Parth',
];

const suffixes = ['Dancer', 'King', 'Queen', 'Star', 'Spark', ''];

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** e.g. "DiyaDancer_Avni_4821", "GarbaKing_Arjun_7302" */
export function generateDisplayName() {
  return `${pick(adjectives)}${pick(suffixes)}_${pick(names)}_${Math.floor(Math.random() * 9000 + 1000)}`;
}

const pattern = new RegExp(
  `^(${adjectives.join('|')})(${suffixes.filter(Boolean).join('|')})?_(${names.join('|')})_[1-9]\\d{3}$`,
);

/** Only names our generator could have produced are accepted at onboarding. */
export function isGeneratedName(name: string) {
  return pattern.test(name);
}
