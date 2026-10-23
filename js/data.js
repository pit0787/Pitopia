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

// wind: Richtung in Grad, in die der Wind weht (0 = +z, 90 = +x).
// Strecken führen vom Start zum Ziel (keine Runden). Jede Strecke besteht aus Abschnitten
// [Gerade in m, Kurve in Grad (+ = rechts), Kurvenradius]. straightScale kürzt alle Geraden,
// damit ein Rennen sicher unter dem Zeitlimit von 3:00 bleibt.
const TRACKS = [
  {
    id: 'lagune', name: 'Sonnen-Küste', difficulty: 'Kurz', width: 56, wind: 210, straightScale: 1.0,
    sky: [0x6fd0f2, 0xd9f6ff], water: [0x1aa3c8, 0x7fe3ee], sand: 0xf5e1a4,
    legs: [[260, 35], [380, -70], [420, 55], [300, -45, 90], [480, 80], [330, -100, 70], [400, 50], [350, -35], [420, 60], [300, -40], [360, 0]],
  },
  {
    id: 'riff', name: 'Korallen-Riff', difficulty: 'Mittel', width: 52, wind: 120, straightScale: 0.94,
    sky: [0x78c8ff, 0xfff0d6], water: [0x0e8fbf, 0x5fe0d8], sand: 0xffd6a5,
    legs: [[240, 80, 70], [300, -130, 65], [380, 60], [260, -95, 60], [420, 40], [300, 100, 65], [340, -120, 60], [400, 70], [280, -50],
           [450, 85, 70], [300, -110, 60], [380, 45], [320, 0]],
  },
  {
    id: 'kap', name: 'Sturm-Kap', difficulty: 'Lang', width: 48, wind: 320, straightScale: 0.94,
    sky: [0x5a8fc8, 0xe6d8ff], water: [0x0b6f9e, 0x48c6d6], sand: 0xe8d2a0,
    legs: [[260, 60], [420, -90, 65], [500, 40], [300, 165, 75], [380, -40], [300, -130, 70], [460, 70], [260, -60], [480, 100, 70],
           [320, -150, 72], [420, 50], [300, -80], [380, 60], [300, 0]],
  },
];

// Items: Gewichtungen nach Abstand zum Führenden (nicht nach Platz).
// Der Führende bekommt vor allem Verteidigung, dicht dahinter einfache Items,
// wer weit zurückliegt die starken Aufhol-Items.
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

const ITEM_TABLE = {
  lead:  { seaweed: 35, shield: 25, energy: 20, torpedo: 15, boost: 5 },                     // Platz 1
  close: { boost: 28, torpedo: 25, seaweed: 15, energy: 17, shield: 15 },                    // < 60 m Rückstand
  mid:   { boost: 20, puffer: 20, torpedo: 15, triple: 15, energy: 15, shield: 10, seaweed: 5 }, // < 200 m
  far:   { triple: 28, puffer: 22, calm: 12, boost: 14, energy: 12, shield: 12 },             // weit hinten
};

// K.-o.-Cup: nach jedem Rennen scheiden die Letzten aus
const CUP_ROUNDS = [
  { name: 'Vorrunde', track: 0, out: 2 },
  { name: 'Halbfinale', track: 1, out: 2 },
  { name: 'Finale', track: 2, out: 0 },
];

const RACE_TIME_LIMIT = 180; // Sekunden

// ===================================================================
// Ausrüstung: echte Kite- und Twintip-Modelle (Stand der Recherche 2025/26).
// Die Werte 1–5 sind eine spielerische Einordnung nach dem Einsatzbereich, den die
// Hersteller bzw. Händler angeben (Big Air, Freeride, Freestyle, Welle) – keine Messwerte.
// Jeder Gegenstand hat wie die Fahrer 15 Punkte. Wirkung im Spiel: (Wert − 3) × 0,5
// wird auf den Wert des Fahrers addiert, also −1 bis +1 pro Eigenschaft.
// shape: Kite-Form fürs 3D-Modell (A = Spannweite, chord = Profiltiefe, R = Bogenradius)
// ===================================================================
const GEAR_EFFECT = 0.5;

const KITES = [
  { id: 'rebel', brand: 'Duotone', model: 'Rebel', category: 'Big Air / Freeride',
    desc: 'Viel Lift und Hangtime', c1: 0xff4f4f, c2: 0x2b3a55, shape: { A: 1.25, chord: 1.75, R: 3.8 },
    stats: { speed: 3, agility: 2, skill: 3, jump: 5, trick: 2 } },
  { id: 'evo', brand: 'Duotone', model: 'Evo', category: 'Allround',
    desc: 'Kann alles ein bisschen', c1: 0x2bb5d8, c2: 0xffffff, shape: { A: 1.15, chord: 2.0, R: 3.6 },
    stats: { speed: 3, agility: 3, skill: 4, jump: 3, trick: 2 } },
  { id: 'dice', brand: 'Duotone', model: 'Dice', category: 'Freestyle / Welle',
    desc: 'Dreht schnell, für Tricks', c1: 0xffd23f, c2: 0x8a3bff, shape: { A: 1.05, chord: 2.2, R: 3.2 },
    stats: { speed: 3, agility: 4, skill: 2, jump: 2, trick: 4 } },
  { id: 'orbit', brand: 'North', model: 'Orbit', category: 'Big Air',
    desc: 'Für die ganz hohen Sprünge', c1: 0x1a1a2e, c2: 0xff9f1c, shape: { A: 1.3, chord: 1.7, R: 3.9 },
    stats: { speed: 4, agility: 2, skill: 2, jump: 5, trick: 2 } },
  { id: 'carve', brand: 'North', model: 'Carve', category: 'Welle',
    desc: 'Wendig, verzeiht viel', c1: 0x6be37a, c2: 0x1b7fa3, shape: { A: 1.0, chord: 2.3, R: 3.3 },
    stats: { speed: 2, agility: 5, skill: 4, jump: 1, trick: 3 } },
  { id: 'switchblade', brand: 'Cabrinha', model: 'Switchblade', category: 'Freeride',
    desc: 'Stabil und direkt', c1: 0xff7eb6, c2: 0x2b3a55, shape: { A: 1.2, chord: 1.9, R: 3.7 },
    stats: { speed: 3, agility: 2, skill: 4, jump: 4, trick: 2 } },
  { id: 'xr', brand: 'CORE', model: 'XR', category: 'Freeride / Hangtime',
    desc: 'Leichter Neustart, sehr gutmütig', c1: 0xf4f6fa, c2: 0xff4f4f, shape: { A: 1.18, chord: 2.0, R: 3.6 },
    stats: { speed: 2, agility: 3, skill: 5, jump: 3, trick: 2 } },
  { id: 'vortex', brand: 'Ozone', model: 'Vortex', category: 'Big Air / Kiteloop',
    desc: 'Schnell und aggressiv', c1: 0x3a4bd8, c2: 0x8ff0ff, shape: { A: 1.22, chord: 1.8, R: 3.6 },
    stats: { speed: 4, agility: 3, skill: 1, jump: 4, trick: 3 } },
];

const BOARDS = [
  { id: 'jaime', brand: 'Duotone', model: 'Jaime', category: 'Freestyle',
    desc: 'Der Klassiker für Tricks', c1: 0x2b3a55, c2: 0xffd23f,
    stats: { speed: 3, agility: 3, skill: 3, jump: 2, trick: 4 } },
  { id: 'atmos', brand: 'North', model: 'Atmos', category: 'Big Air / Freeride',
    desc: 'Harte Landungen? Kein Problem', c1: 0x1a1a2e, c2: 0xff9f1c,
    stats: { speed: 3, agility: 2, skill: 3, jump: 5, trick: 2 } },
  { id: 'astra', brand: 'North', model: 'Astra', category: 'Big Air (leicht)',
    desc: 'Leicht und verspielt', c1: 0xff7eb6, c2: 0xffffff,
    stats: { speed: 2, agility: 4, skill: 3, jump: 4, trick: 2 } },
  { id: 'ace', brand: 'Cabrinha', model: 'Ace', category: 'Freeride / Freestyle',
    desc: 'Allrounder für alles', c1: 0x2bb5d8, c2: 0x1a1a2e,
    stats: { speed: 3, agility: 3, skill: 3, jump: 3, trick: 3 } },
  { id: 'vapor', brand: 'Cabrinha', model: 'Vapor', category: 'Big Air / Freestyle',
    desc: 'Steif, viel Pop', c1: 0xff4f4f, c2: 0xf4f6fa,
    stats: { speed: 3, agility: 2, skill: 2, jump: 4, trick: 4 } },
  { id: 'monarch', brand: 'Naish', model: 'Monarch', category: 'Big Air / Performance',
    desc: 'Schnell und kantenstark', c1: 0xffd23f, c2: 0x2b3a55,
    stats: { speed: 4, agility: 2, skill: 2, jump: 4, trick: 3 } },
  { id: 'motion', brand: 'Naish', model: 'Motion', category: 'Freeride',
    desc: 'Weich und komfortabel', c1: 0x6be37a, c2: 0x2b3a55,
    stats: { speed: 3, agility: 3, skill: 5, jump: 2, trick: 2 } },
  { id: 'fusion', brand: 'CORE', model: 'Fusion', category: 'Freeride / Speed',
    desc: 'Läuft schnell geradeaus', c1: 0x8a3bff, c2: 0x8ff0ff,
    stats: { speed: 5, agility: 2, skill: 3, jump: 3, trick: 2 } },
];
