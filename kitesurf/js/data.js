// Spieldaten: Charaktere, Strecken, Items
// Werte der Eigenschaften: 1 (schwach) bis 5 (stark), jeder Charakter hat insgesamt 15 Punkte.

const CHARACTERS = [
  { id: 'kiko',   name: 'Kiko',    type: 'Pinguin',     emoji: '🐧', species: 'penguin',
    color: 0x2b3a55, belly: 0xffffff, kite: 0x2bb5d8, kite2: 0xffd23f, board: 0xff6b6b,
    stats: { speed: 3, agility: 3, skill: 3, jump: 3, trick: 3 }, desc: 'Allrounder' },
  { id: 'rosa',   name: 'Rosa',    type: 'Robbe',       emoji: '🦭', species: 'seal',
    color: 0x9aa7b8, belly: 0xd9e1ea, kite: 0xff7eb6, kite2: 0xffffff, board: 0x3fbf5a,
    stats: { speed: 5, agility: 2, skill: 3, jump: 2, trick: 3 }, desc: 'Rakete' },
  { id: 'karl',   name: 'Karl',    type: 'Krabbe',      emoji: '🦀', species: 'crab',
    color: 0xf0552d, belly: 0xffa47a, kite: 0x6be37a, kite2: 0x1b7fa3, board: 0xffd23f,
    stats: { speed: 2, agility: 5, skill: 4, jump: 2, trick: 2 }, desc: 'Kurvenkönig' },
  { id: 'okto',   name: 'Okto',    type: 'Oktopus',     emoji: '🐙', species: 'octopus',
    color: 0xb36be3, belly: 0xe2b8ff, kite: 0xffa62b, kite2: 0xffffff, board: 0x2bb5d8,
    stats: { speed: 2, agility: 3, skill: 5, jump: 1, trick: 4 }, desc: 'Technik-Profi' },
  { id: 'delfina',name: 'Delfina', type: 'Delfin',      emoji: '🐬', species: 'dolphin',
    color: 0x5fa8e8, belly: 0xe8f4ff, kite: 0xffe14d, kite2: 0xff6b6b, board: 0xffffff,
    stats: { speed: 3, agility: 2, skill: 1, jump: 5, trick: 4 }, desc: 'Höhenflieger' },
  { id: 'taro',   name: 'Taro',    type: 'Schildkröte', emoji: '🐢', species: 'turtle',
    color: 0x6cc56a, belly: 0xf3e3a1, kite: 0xff4f4f, kite2: 0xffd23f, board: 0x8a5a3b,
    stats: { speed: 4, agility: 2, skill: 4, jump: 2, trick: 3 }, desc: 'Fels in der Brandung' },
  { id: 'mika',   name: 'Mika',    type: 'Möwe',        emoji: '🕊️', species: 'gull',
    color: 0xf4f6fa, belly: 0xffffff, kite: 0x3a4bd8, kite2: 0x8ff0ff, board: 0xff9f1c,
    stats: { speed: 3, agility: 4, skill: 2, jump: 4, trick: 2 }, desc: 'Luftakrobat' },
  { id: 'fritzi', name: 'Fritzi',  type: 'Frosch',      emoji: '🐸', species: 'frog',
    color: 0x8ad83b, belly: 0xe9ffb8, kite: 0xff3fa4, kite2: 0x8a3bff, board: 0x2b3a55,
    stats: { speed: 2, agility: 3, skill: 1, jump: 4, trick: 5 }, desc: 'Trick-Meister' },
];

const STAT_LABELS = {
  speed: 'Schnelligkeit', agility: 'Wendigkeit', skill: 'Geschicklichkeit', jump: 'Sprunghöhe', trick: 'Trick-Level',
};

// Streckenform als normierte Kontrollpunkte (x, z). Die Strecke wird beim Laden
// auf die Ziellänge skaliert. Rundenzahl so gewählt, dass ein Rennen ~2:30 dauert;
// das Zeitlimit beträgt immer 3:00.
const TRACKS = [
  {
    id: 'lagune', name: 'Sonnen-Lagune', difficulty: 'Kurz', length: 1050, laps: 5, width: 34,
    sky: [0x6fd0f2, 0xd9f6ff], water: [0x1aa3c8, 0x7fe3ee], sand: 0xf5e1a4,
    points: [[0, -1], [0.75, -0.85], [1, -0.2], [0.8, 0.55], [0.25, 0.8], [-0.35, 0.95], [-0.9, 0.6], [-1, -0.1], [-0.6, -0.75]],
  },
  {
    id: 'riff', name: 'Korallen-Riff', difficulty: 'Mittel', length: 1750, laps: 3, width: 32,
    sky: [0x78c8ff, 0xfff0d6], water: [0x0e8fbf, 0x5fe0d8], sand: 0xffd6a5,
    points: [[0, -1], [0.6, -0.95], [0.95, -0.55], [0.6, -0.15], [0.95, 0.3], [0.75, 0.85], [0.15, 0.7], [-0.2, 0.25], [-0.55, 0.85],
             [-0.95, 0.55], [-0.85, -0.05], [-0.45, -0.3], [-0.75, -0.75]],
  },
  {
    id: 'kap', name: 'Sturm-Kap', difficulty: 'Lang', length: 2700, laps: 2, width: 30,
    sky: [0x5a8fc8, 0xe6d8ff], water: [0x0b6f9e, 0x48c6d6], sand: 0xe8d2a0,
    points: [[0, -1], [0.45, -0.9], [0.55, -0.55], [0.9, -0.7], [1, -0.25], [0.65, 0.05], [0.95, 0.4], [0.7, 0.9], [0.3, 0.65],
             [0.05, 0.95], [-0.35, 0.7], [-0.15, 0.35], [-0.6, 0.2], [-0.95, 0.5], [-1, 0], [-0.7, -0.35], [-0.95, -0.75], [-0.45, -0.95]],
  },
];

// Items: weight-Tabellen nach Platzierung (vorne / Mitte / hinten)
const ITEMS = {
  boost:    { name: 'Wind-Böe',     icon: '💨', desc: 'Kurzer Turbo' },
  triple:   { name: '3x Böe',       icon: '🌪️', desc: 'Drei Turbos' },
  energy:   { name: 'Kokos-Drink',  icon: '🥥', desc: '+60 Kraft' },
  torpedo:  { name: 'Wasserbombe',  icon: '💣', desc: 'Fliegt geradeaus' },
  puffer:   { name: 'Kugelfisch',   icon: '🐡', desc: 'Verfolgt den Nächsten vor dir' },
  seaweed:  { name: 'Seetang',      icon: '🌿', desc: 'Falle nach hinten' },
  shield:   { name: 'Schutzblase',  icon: '🫧', desc: 'Schützt vor einem Treffer' },
  calm:     { name: 'Flaute',       icon: '🌫️', desc: 'Alle vor dir verlieren Kraft & Tempo' },
};

const ITEM_TABLE = [
  { seaweed: 30, torpedo: 30, energy: 20, boost: 15, shield: 5 },                          // vorne
  { boost: 22, torpedo: 20, puffer: 18, energy: 15, shield: 10, triple: 10, seaweed: 5 },  // Mitte
  { triple: 28, puffer: 24, boost: 14, energy: 12, shield: 10, calm: 12 },                 // hinten
];

const RACE_TIME_LIMIT = 180; // Sekunden
