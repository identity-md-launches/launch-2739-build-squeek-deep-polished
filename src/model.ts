export type Mode = "normal" | "daily" | "practice";
export type Upgrade = "cheeks" | "pick" | "lamp" | "armor" | "winch" | "luck";
export type Levels = Record<Upgrade, number>;
export const BASE: Levels = {
  cheeks: 0,
  pick: 0,
  lamp: 0,
  armor: 0,
  winch: 0,
  luck: 0,
};
export const UPGRADES: {
  id: Upgrade;
  name: string;
  icon: number;
  costs: number[];
  detail: string;
}[] = [
  {
    id: "cheeks",
    name: "Cheek Stretch",
    icon: 0,
    costs: [150, 400, 900, 1800, 3500],
    detail: "+5 cheek capacity per level",
  },
  {
    id: "pick",
    name: "Pickaxe",
    icon: 10,
    costs: [120, 350, 800, 1600, 3200],
    detail: "15% faster digs. Level 3 breaks boulders.",
  },
  {
    id: "lamp",
    name: "Helmet Lamp",
    icon: 9,
    costs: [200, 600, 1400],
    detail: "+20 light radius and hidden ore glints",
  },
  {
    id: "armor",
    name: "Fur Armor",
    icon: 13,
    costs: [250, 700, 1500],
    detail: "+1 maximum heart per level",
  },
  {
    id: "winch",
    name: "Wheel Winch",
    icon: 14,
    costs: [300, 900, 2000],
    detail: "+30% basket speed. Stops every 50m.",
  },
  {
    id: "luck",
    name: "Lucky Whiskers",
    icon: 2,
    costs: [400, 1000, 2400],
    detail: "+5% rare drop chance per level",
  },
];
export const ITEMS = [
  { name: "Sunflower seed", weight: 1, value: 5 },
  { name: "Pumpkin seed", weight: 1, value: 5 },
  { name: "Golden acorn", weight: 2, value: 12 },
  { name: "Walnut", weight: 2, value: 12 },
  { name: "Amber", weight: 3, value: 20 },
  { name: "Emerald", weight: 3, value: 35 },
  { name: "Sapphire", weight: 3, value: 35 },
  { name: "Ruby", weight: 3, value: 45 },
  { name: "Amethyst", weight: 3, value: 45 },
  { name: "Crystal shard", weight: 3, value: 30 },
  { name: "Gold nugget", weight: 3, value: 40 },
  { name: "Fossil", weight: 3, value: 60 },
  { name: "Magma heart", weight: 5, value: 150 },
  { name: "Heart", weight: 0, value: 0 },
  { name: "Battery", weight: 0, value: 0 },
  { name: "Treasure chest", weight: 6, value: 120 },
];
export const LAYERS = [
  {
    name: "Topsoil",
    from: 0,
    to: 40,
    hp: 1,
    ore: 0.1,
    loot: [0, 1],
    enemies: [0],
    color: "#bc7940",
  },
  {
    name: "Clay",
    from: 40,
    to: 90,
    hp: 2,
    ore: 0.12,
    loot: [2, 3, 4],
    enemies: [0, 1],
    color: "#dc9059",
  },
  {
    name: "Stone",
    from: 90,
    to: 150,
    hp: 3,
    ore: 0.12,
    loot: [10, 11, 5],
    enemies: [1, 2],
    color: "#9eacc3",
  },
  {
    name: "Crystal cave",
    from: 150,
    to: 210,
    hp: 3,
    ore: 0.16,
    loot: [6, 8, 9],
    enemies: [3, 2],
    color: "#8ce6ff",
  },
  {
    name: "Fungal hollow",
    from: 210,
    to: 260,
    hp: 2,
    ore: 0.14,
    loot: [7, 8, 15],
    enemies: [3, 1],
    color: "#b7e48a",
  },
  {
    name: "Magma deep",
    from: 260,
    to: 300,
    hp: 4,
    ore: 0.18,
    loot: [12, 7],
    enemies: [4, 1],
    color: "#ff8a20",
  },
];
export const layerAt = (row: number) =>
  row < 40
    ? 0
    : row < 90
      ? 1
      : row < 150
        ? 2
        : row < 210
          ? 3
          : row < 260
            ? 4
            : 5;
export function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const utcDate = () => new Date().toISOString().slice(0, 10);
export interface Tile {
  solid: boolean;
  hp: number;
  variant: number;
  ore: number;
  rock: boolean;
}
export function makeWorld(seed: number): Tile[][] {
  const rand = random(seed);
  const noise = (x: number, y: number) =>
    (hash(`${seed}:${x}:${y}`) % 10000) / 10000;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  function valueNoise(x: number, y: number) {
    const ix = Math.floor(x),
      iy = Math.floor(y),
      fx = smooth(x - ix),
      fy = smooth(y - iy);
    const a = noise(ix, iy) * (1 - fx) + noise(ix + 1, iy) * fx;
    const b = noise(ix, iy + 1) * (1 - fx) + noise(ix + 1, iy + 1) * fx;
    return a * (1 - fy) + b * fy;
  }
  return Array.from({ length: 300 }, (_, y) =>
    Array.from({ length: 15 }, (_, x) => {
      const l = LAYERS[layerAt(y)];
      const cavern = y >= 120 && valueNoise(x / 3, y / 5) > 0.68;
      const niche = y > 5 && y % 12 < 2 && x > 3 && x < 10;
      const entrance = y < 3 && x >= 6 && x <= 8;
      const solid = !(cavern || niche || entrance);
      const ore =
        rand() < l.ore ? l.loot[Math.floor(rand() * l.loot.length)] : -1;
      return {
        solid,
        hp: l.hp,
        variant: rand() > 0.5 ? 1 : 0,
        ore: ore === 15 && rand() > 0.12 ? 8 : ore,
        rock: solid && y > 15 && x !== 7 && rand() < 0.016,
      };
    }),
  );
}
export interface Entry {
  id: string;
  mode: Mode;
  name: string;
  addr?: string;
  score: number;
  depth: number;
  hoard: number;
  best: number;
  date: string;
  seedHash: string;
  txHash?: string;
  wheel: string;
}
export interface Save {
  upgrades: Levels;
  hoard: number;
  practiceHoard: number;
  practiceUpgrades: Levels;
  settings: {
    muted: boolean;
    music: number;
    sfx: number;
    reducedMotion: boolean;
  };
  name: string;
  lastDepth: number;
}
export const freshSave = (): Save => ({
  upgrades: { ...BASE },
  practiceUpgrades: { ...BASE },
  hoard: 0,
  practiceHoard: 0,
  settings: { muted: false, music: 0.4, sfx: 0.65, reducedMotion: false },
  name: "Pip",
  lastDepth: 0,
});
export function readSave(): Save {
  try {
    const s = JSON.parse(localStorage.getItem("squeekdeep.v1.save") || "null");
    const fresh = freshSave();
    if (!s || typeof s !== "object") return fresh;
    const levels = (v: Levels) =>
      Object.fromEntries(
        UPGRADES.map((u) => [
          u.id,
          Math.min(
            u.costs.length,
            Math.max(0, Math.floor(Number(v?.[u.id]) || 0)),
          ),
        ]),
      ) as Levels;
    const nonnegative = (v: unknown) =>
      Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0;
    const volume = (v: unknown, fallback: number) =>
      Number.isFinite(Number(v))
        ? Math.max(0, Math.min(1, Number(v)))
        : fallback;
    return {
      ...fresh,
      name: String(s.name || "Pip").slice(0, 20),
      lastDepth: Math.min(300, nonnegative(s.lastDepth)),
      hoard: nonnegative(s.hoard),
      practiceHoard: nonnegative(s.practiceHoard),
      upgrades: levels(s.upgrades),
      practiceUpgrades: levels(s.practiceUpgrades),
      settings: {
        muted: s.settings?.muted === true,
        reducedMotion: s.settings?.reducedMotion === true,
        music: volume(s.settings?.music, 0.4),
        sfx: volume(s.settings?.sfx, 0.65),
      },
    };
  } catch {
    return freshSave();
  }
}
export function readLeaderboard(): Entry[] {
  try {
    const a = JSON.parse(localStorage.getItem("squeekdeep.v1.lb") || "[]");
    return Array.isArray(a)
      ? a.filter(
          (e) =>
            e &&
            Number.isFinite(e.score) &&
            ["normal", "daily", "practice"].includes(e.mode),
        )
      : [];
  } catch {
    return [];
  }
}
export function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function rank(entries: Entry[]) {
  return (["normal", "daily", "practice"] as Mode[]).flatMap((mode) =>
    entries
      .filter((e) => e.mode === mode)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20),
  );
}
export const shortAddress = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
