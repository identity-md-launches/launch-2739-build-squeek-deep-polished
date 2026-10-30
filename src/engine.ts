import { audio, type Images } from "./assets";
import {
  BASE,
  ITEMS,
  LAYERS,
  fmt,
  hash,
  layerAt,
  makeWorld,
  random,
  utcDate,
  type Entry,
  type Levels,
  type Mode,
  type Tile,
} from "./model";
import { initialWheel, type Wheel } from "./wheel";

export const WIDTH = 480,
  HEIGHT = 270,
  TILE = 32,
  SURFACE = 160;
const ENEMIES = [
  "root_beetle",
  "mole_shade",
  "glow_worm",
  "crystal_bat",
  "magma_slug",
];
const HP = [1, 3, 2, 1, 4];
type Loot = { item: number; value: number };
interface Drop extends Loot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  delay: number;
}
interface Enemy {
  type: number;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  hp: number;
  time: number;
  phase: number;
  clock: number;
  hurt: number;
  dir: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  item?: number;
}
interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}
interface Hazard {
  x: number;
  y: number;
  life: number;
  kind: "slime" | "fire";
}
export interface Snapshot {
  depth: number;
  maxDepth: number;
  layer: string;
  hp: number;
  maxHP: number;
  load: number;
  capacity: number;
  stage: number;
  value: number;
  hoard: number;
  best: number;
  atCamp: boolean;
  riding: boolean;
  battery: number;
  quakes: number;
  message: string;
  seconds: number;
}
export class Game {
  world: Tile[][] = [];
  p = {
    x: 176,
    y: SURFACE,
    vx: 0,
    vy: 0,
    facing: 1,
    grounded: true,
    coyote: 0.09,
    buffer: 0,
    hurt: 0,
    jumpHeld: false,
    boost: 0,
    hop: 0,
  };
  mode: Mode = "normal";
  levels = { ...BASE };
  date = utcDate();
  seed = 0;
  seedHash = "";
  hp = 3;
  maxHP = 3;
  maxDepth = 0;
  hoard = 0;
  best = 0;
  inventory: Loot[] = [];
  drops: Drop[] = [];
  enemies: Enemy[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  hazards: Hazard[] = [];
  keys = new Set<string>();
  wheel: Wheel = initialWheel();
  paused = true;
  ended = false;
  riding = false;
  started = false;
  battery = 0;
  quakes = 0;
  seconds = 0;
  camera = 0;
  shake = 0;
  shakePower = 0;
  hitStop = 0;
  reducedMotion = false;
  visibleWidth = WIDTH;
  message = "Welcome to camp. Your next adventure starts below.";
  private messageTime = 8;
  private digClock = 0;
  private digAnimation = 0;
  private diggingDown = false;
  private digTarget = "";
  private rand = random(1);
  private lanterns: { x: number; y: number }[] = [];
  private lastFull = -10;
  private lastLayer = 0;
  private pendingQuakes = 0;
  private basketStop = 0;
  private lastBasketDepth = 301;
  private mask: HTMLCanvasElement;
  private maskContext: CanvasRenderingContext2D;
  private lightStamp: HTMLCanvasElement;
  private terrainCanvas: HTMLCanvasElement;
  private terrainContext: CanvasRenderingContext2D;
  private terrainRevision = 0;
  private terrainCachedRevision = -1;
  private terrainRow = -1;
  private magmaCanvas: HTMLCanvasElement;
  private magmaContext: CanvasRenderingContext2D;
  private magmaRow = -1;
  private magmaRevision = -1;
  constructor(
    public canvas: HTMLCanvasElement,
    public images: Images,
    private onEnd: (entry: Omit<Entry, "name" | "addr">) => void,
    private onDeposit: (value: number, mode: Mode) => void,
  ) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.terrainCanvas = document.createElement("canvas");
    this.terrainCanvas.width = WIDTH;
    this.terrainCanvas.height = 384;
    this.terrainContext = this.terrainCanvas.getContext("2d")!;
    this.terrainContext.imageSmoothingEnabled = false;
    this.magmaCanvas = document.createElement("canvas");
    this.magmaCanvas.width = WIDTH;
    this.magmaCanvas.height = 384;
    this.magmaContext = this.magmaCanvas.getContext("2d")!;
    this.magmaContext.imageSmoothingEnabled = false;
    this.mask = document.createElement("canvas");
    this.mask.width = WIDTH;
    this.mask.height = HEIGHT;
    this.maskContext = this.mask.getContext("2d")!;
    this.maskContext.imageSmoothingEnabled = false;
    this.lightStamp = document.createElement("canvas");
    this.lightStamp.width = this.lightStamp.height = 256;
    const lightContext = this.lightStamp.getContext("2d")!;
    const light = lightContext.createRadialGradient(
      128,
      128,
      15.36,
      128,
      128,
      128,
    );
    light.addColorStop(0, "rgba(0,0,0,1)");
    light.addColorStop(1, "rgba(0,0,0,0)");
    lightContext.fillStyle = light;
    lightContext.fillRect(0, 0, 256, 256);
  }
  start(mode: Mode, levels: Levels) {
    this.mode = mode;
    this.date = utcDate();
    this.seed =
      mode === "daily"
        ? hash(this.date)
        : hash(`${this.date}:${crypto.getRandomValues(new Uint32Array(1))[0]}`);
    this.seedHash = this.seed.toString(16).padStart(8, "0");
    this.rand = random(this.seed ^ 0x4ac21);
    this.world = makeWorld(this.seed);
    this.terrainRevision++;
    this.terrainRow = -1;
    this.levels = mode === "daily" ? { ...BASE } : { ...levels };
    this.p = {
      x: 176,
      y: SURFACE,
      vx: 0,
      vy: 0,
      facing: 1,
      grounded: true,
      coyote: 0.09,
      buffer: 0,
      hurt: 0,
      jumpHeld: false,
      boost: 0,
      hop: 0,
    };
    this.hp = this.maxHP = 3 + this.levels.armor;
    this.hoard = this.best = this.maxDepth = 0;
    this.inventory = [];
    this.drops = [];
    this.enemies = [];
    this.particles = [];
    this.popups = [];
    this.hazards = [];
    this.seconds =
      this.camera =
      this.quakes =
      this.battery =
      this.shake =
      this.hitStop =
      this.digClock =
      this.digAnimation =
      this.basketStop =
        0;
    this.riding = this.ended = false;
    this.started = true;
    this.paused = false;
    this.lastLayer = this.pendingQuakes = 0;
    this.lastFull = -10;
    this.keys.clear();
    this.lanterns = [];
    for (let row = 25; row < 300; row += 25) {
      this.lanterns.push({
        x: (row % 50 ? 5 : 9) * 32 + 16,
        y: SURFACE + row * 32,
      });
    }
    // One reachable ore seam teaches the loop before the first enemy.
    for (const [x, y] of [
      [6, 3],
      [7, 3],
      [8, 3],
      [5, 1],
      [9, 1],
    ])
      this.world[y][x].ore = 0;
    // A little battery near the entrance gives an offline visitor a first return trip.
    this.spawnDrop(14, 250, SURFACE + 58, 0);
    for (let row = 12; row <= 300; row += 12) this.spawnEnemy(row);
    this.say(
      mode === "practice"
        ? "Practice mine · offline · unranked. Dig down to begin!"
        : mode === "daily"
          ? `Daily mine · ${this.date} · everyone starts with base stats.`
          : "Hello, Pip! Dig down. Bring a little treasure home.",
    );
  }
  get depth() {
    return Math.min(300, Math.max(0, Math.floor((this.p.y - SURFACE) / TILE)));
  }
  get capacity() {
    return 10 + this.levels.cheeks * 5;
  }
  get load() {
    return this.inventory.reduce((s, d) => s + ITEMS[d.item].weight, 0);
  }
  get stage() {
    const r = this.load / this.capacity;
    return r < 0.25 ? 0 : r < 0.6 ? 1 : r < 0.9 ? 2 : 3;
  }
  get atCamp() {
    return this.p.y <= SURFACE + 3 && !this.riding;
  }
  get value() {
    return this.inventory.reduce((s, i) => s + i.value, 0);
  }
  snapshot(): Snapshot {
    return {
      depth: this.depth,
      maxDepth: this.maxDepth,
      layer: LAYERS[layerAt(this.depth)].name,
      hp: this.hp,
      maxHP: this.maxHP,
      load: this.load,
      capacity: this.capacity,
      stage: this.stage,
      value: this.value,
      hoard: this.hoard,
      best: this.best,
      atCamp: this.atCamp,
      riding: this.riding,
      battery: this.battery,
      quakes: this.quakes,
      message: this.message,
      seconds: this.seconds,
    };
  }
  setWheel(w: Wheel, quake: boolean) {
    if (w.active !== this.wheel.active)
      audio.play(w.active ? "power_on" : "power_off");
    this.wheel = w;
    if (quake && this.started && !this.ended) {
      if (this.paused) this.pendingQuakes++;
      else this.earthquake();
    }
  }
  press(key: string) {
    if (this.keys.has(key)) return;
    this.keys.add(key);
    if (this.paused || this.ended) return;
    if ([" ", "w", "arrowup"].includes(key)) {
      this.p.buffer = 0.12;
      this.p.jumpHeld = true;
    }
    if (key === "q") this.callBasket();
    if (key === "e") this.spit();
    if (key === "f" && this.atCamp) this.deposit();
  }
  release(key: string) {
    this.keys.delete(key);
    if ([" ", "w", "arrowup"].includes(key)) this.p.jumpHeld = false;
  }
  clearInput() {
    this.keys.clear();
    this.p.jumpHeld = false;
    this.p.buffer = 0;
  }
  say(message: string, duration = 5) {
    this.message = message;
    this.messageTime = duration;
  }
  private tile(x: number, y: number) {
    return this.world[Math.floor((y - SURFACE) / TILE)]?.[Math.floor(x / TILE)];
  }
  solid(x: number, y: number) {
    return (
      x < 0 ||
      x >= WIDTH ||
      y >= SURFACE + 300 * TILE ||
      (y >= SURFACE && !!this.tile(x, y)?.solid)
    );
  }
  private collides(x: number, y: number) {
    return (
      this.solid(x - 8, y - 1) ||
      this.solid(x + 8, y - 1) ||
      this.solid(x - 8, y - 23) ||
      this.solid(x + 8, y - 23)
    );
  }
  private move(dx: number, dy: number) {
    const p = this.p;
    const steps = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6),
    );
    for (let i = 0; i < steps; i++) {
      if (!this.collides(p.x + dx / steps, p.y)) p.x += dx / steps;
      else p.vx = 0;
      if (!this.collides(p.x, p.y + dy / steps)) p.y += dy / steps;
      else {
        if (dy > 0) {
          p.grounded = true;
          p.coyote = 0.09;
        }
        p.vy = 0;
      }
    }
    p.x = Math.max(10, Math.min(WIDTH - 10, p.x));
  }
  update(dt: number) {
    if (!this.started || this.paused || this.ended) return;
    dt = Math.min(0.035, dt);
    if (this.pendingQuakes) {
      this.pendingQuakes--;
      this.earthquake();
    }
    this.seconds += dt;
    this.messageTime -= dt;
    if (this.messageTime < 0) this.message = "";
    this.shake = Math.max(0, this.shake - dt);
    this.p.hurt = Math.max(0, this.p.hurt - dt);
    this.p.boost = Math.max(0, this.p.boost - dt);
    this.p.hop = Math.max(0, this.p.hop - dt);
    this.digAnimation = Math.max(0, this.digAnimation - dt);
    this.hitStop = Math.max(0, this.hitStop - dt);
    if (this.hitStop > 0) return;
    const p = this.p;
    if (this.riding) this.updateBasket(dt);
    else {
      const left = this.keys.has("a") || this.keys.has("arrowleft");
      const right = this.keys.has("d") || this.keys.has("arrowright");
      const down = this.keys.has("s") || this.keys.has("arrowdown");
      const dir = Number(right) - Number(left);
      const r = this.load / this.capacity;
      if (dir) p.facing = dir;
      if (p.hurt < 0.95)
        p.vx = dir * 96 * (1 - 0.35 * r) * (p.boost > 0 ? 1.6 : 1);
      p.coyote -= dt;
      p.buffer -= dt;
      if (p.buffer > 0 && p.coyote > 0) {
        p.vy = -320 * (1 - 0.25 * r);
        p.buffer = p.coyote = 0;
        p.grounded = false;
        audio.play("squeak", 0.3);
      }
      p.vy += (p.vy < 0 && !p.jumpHeld ? 1200 : 680) * dt;
      p.vy = Math.min(p.vy, 420);
      p.grounded = false;
      this.move(p.vx * dt, p.vy * dt);
      const tx = down ? p.x : p.x + p.facing * 18;
      const ty = down ? p.y + 6 : p.y - 12;
      if (down || dir) this.dig(tx, ty, dt, down);
      else {
        this.digClock = 0;
        this.digTarget = "";
      }
      if (this.atCamp && p.x < 125 && this.load) this.deposit();
    }
    this.maxDepth = Math.max(this.maxDepth, this.depth);
    const li = layerAt(this.depth);
    if (li !== this.lastLayer) {
      this.lastLayer = li;
      this.say(`${LAYERS[li].name} · ${this.depth}m. Watch your whiskers!`);
      audio.play("bell", 0.4);
    }
    this.updateDrops(dt);
    this.updateEnemies(dt);
    this.updateEffects(dt);
    const desired = Math.max(
      0,
      Math.min(SURFACE + 300 * TILE - HEIGHT + 25, p.y - 134),
    );
    this.camera += (desired - this.camera) * (1 - Math.pow(0.85, dt * 60));
  }
  private dig(x: number, y: number, dt: number, down: boolean) {
    const t = this.tile(x, y),
      col = Math.floor(x / 32),
      row = Math.floor((y - SURFACE) / 32);
    this.diggingDown = down;
    if (!t?.solid) {
      const enemy = this.enemies.find(
        (e) => e.hp > 0 && Math.hypot(e.x - x, e.y - y) < 32,
      );
      if (enemy) {
        this.digClock += dt;
        this.digAnimation = 0.2;
        if (this.digClock > 0.4) {
          this.digClock = 0;
          this.hitEnemy(enemy);
        }
      } else this.digClock = 0;
      return;
    }
    if (t.rock && this.levels.pick < 3) {
      if (this.message !== "Boulder! Pickaxe level 3 can crack it.")
        this.say("Boulder! Pickaxe level 3 can crack it.");
      return;
    }
    const target = `${col}:${row}`;
    if (this.digTarget !== target) {
      this.digClock = 0;
      this.digTarget = target;
    }
    this.digAnimation = 0.3;
    this.digClock += dt;
    const delay =
      0.45 *
      Math.pow(0.85, this.levels.pick) *
      (1 + (0.2 * this.load) / this.capacity);
    if (this.digClock < delay) return;
    this.digClock = 0;
    t.hp--;
    this.terrainRevision++;
    this.hitStop = 0.04;
    audio.play("dig", 0.5);
    this.burst(
      col * 32 + 16,
      SURFACE + row * 32 + 16,
      7,
      LAYERS[layerAt(row)].color,
    );
    for (const e of this.enemies)
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < 46) this.hitEnemy(e);
    if (t.hp <= 0) {
      t.solid = false;
      t.rock = false;
      audio.play("break", 0.45);
      let ore = t.ore;
      if (this.levels.luck && this.rand() < this.levels.luck * 0.05) {
        const l = LAYERS[layerAt(row)];
        ore = l.loot[l.loot.length - 1];
      } else if (ore < 0 && this.rand() < 0.1) {
        const l = LAYERS[layerAt(row)];
        ore = l.loot[Math.floor(this.rand() * l.loot.length)];
      }
      if (ore >= 0) {
        this.spawnDrop(ore, col * 32 + 16, SURFACE + row * 32 + 16, row);
        if (ore === 15)
          this.spawnDrop(
            [5, 6, 7, 8][Math.floor(this.rand() * 4)],
            col * 32 + 16,
            SURFACE + row * 32 + 16,
            row,
          );
      }
      if (this.rand() < 0.018)
        this.spawnDrop(
          this.rand() < 0.5 ? 13 : 14,
          col * 32 + 16,
          SURFACE + row * 32 + 12,
          row,
        );
    }
  }
  private spawnDrop(
    item: number,
    x: number,
    y: number,
    depth: number,
    value?: number,
    delay = 0.12,
  ) {
    this.drops.push({
      item,
      value: value ?? Math.round(ITEMS[item].value * (1 + depth / 150)),
      x,
      y,
      vx: (this.rand() - 0.5) * 65,
      vy: -70,
      age: 0,
      delay,
    });
    if (this.drops.length > 200) this.drops.shift();
  }
  private updateDrops(dt: number) {
    for (const d of this.drops) {
      d.age += dt;
      d.delay -= dt;
      if (Math.abs(d.y - this.p.y) > 500) continue;
      d.vy += 320 * dt;
      if (!this.solid(d.x + d.vx * dt, d.y)) d.x += d.vx * dt;
      else d.vx *= -0.5;
      if (!this.solid(d.x, d.y + d.vy * dt + 4)) d.y += d.vy * dt;
      else {
        d.vy *= -0.3;
        d.vx *= 0.85;
      }
      d.x = Math.max(8, Math.min(472, d.x));
      const distance = Math.hypot(d.x - this.p.x, d.y - (this.p.y - 12));
      if (d.delay > 0 || distance > 24) continue;
      if (d.item === 13) {
        if (this.hp < this.maxHP) {
          this.hp++;
          d.age = -999;
          this.popup("+1 heart", "#ff8ca3");
          audio.play("pickup_gem");
        }
        continue;
      }
      if (d.item === 14) {
        this.battery += 20;
        d.age = -999;
        this.say("Battery found! +20 seconds of basket power.");
        audio.play("pickup_gem");
        continue;
      }
      if (this.load + ITEMS[d.item].weight > this.capacity) {
        if (this.seconds - this.lastFull > 3) {
          this.say("Cheeks full! Take your treasure to the hoard.");
          audio.play("squeak");
          this.lastFull = this.seconds;
        }
        continue;
      }
      d.x += (this.p.x - d.x) * dt * 12;
      d.y += (this.p.y - 12 - d.y) * dt * 12;
      if (distance < 19) {
        this.inventory.push({ item: d.item, value: d.value });
        d.age = -999;
        this.p.hop = 0.22;
        this.popup(`+${d.value}`, d.item < 4 ? "#ffce40" : "#8ce6ff");
        audio.play(d.item < 4 ? "pickup_seed" : "pickup_gem", 0.6);
        if (this.load === this.capacity) {
          this.say("Cheeks full! Take your treasure to the hoard.");
          audio.play("squeak");
          this.lastFull = this.seconds;
        }
      }
    }
    this.drops = this.drops.filter((d) => d.age >= 0);
  }
  deposit() {
    if (!this.atCamp) return;
    const value = this.value;
    if (!value) {
      this.say("Your hoard is hungry. Bring back seeds and gems!");
      return;
    }
    this.hoard += value;
    this.best = Math.max(this.best, value);
    this.inventory = [];
    this.onDeposit(value, this.mode);
    audio.play("coin");
    this.popup(`+${fmt(value)} hoarded!`, "#ffce40");
    this.burst(88, SURFACE - 30, 30, "#ffce40", 0);
    this.say(`A lovely little haul! ${fmt(value)} seeds safely hoarded.`);
  }
  spit() {
    if (!this.load) {
      this.say("Your cheeks are empty. Dig up a snack first.");
      return;
    }
    for (const d of this.inventory)
      this.spawnDrop(d.item, this.p.x, this.p.y - 15, this.depth, d.value, 2.2);
    this.inventory = [];
    this.p.boost = 2;
    audio.play("squeak");
    this.say("Ptooey! Light cheeks, speedy feet.");
    for (const e of this.enemies)
      if (Math.hypot(e.x - this.p.x, e.y - this.p.y) < 72) {
        e.x += Math.sign(e.x - this.p.x || 1) * 45;
        e.hurt = 0.4;
      }
  }
  callBasket() {
    if (this.riding) {
      this.riding = false;
      this.p.vy = 0;
      this.say("Basket released. Keep an eye on your footing.");
      return;
    }
    if (this.atCamp) {
      this.say("The basket brings you home. Dig down, then call it with Q.");
      return;
    }
    if (!this.wheel.active && this.battery <= 0) {
      this.say("The wheel is resting. Find a battery or jump back up.");
      audio.play("power_off", 0.4);
      return;
    }
    this.riding = true;
    this.p.vx = this.p.vy = 0;
    this.digClock = 0;
    this.basketStop = 0;
    this.lastBasketDepth = this.depth;
    this.say("Going up! Q to step off.");
    audio.play("bell", 0.4);
  }
  private updateBasket(dt: number) {
    if (!this.wheel.active) {
      if (this.battery <= 0) {
        this.riding = false;
        this.say("Basket power ran out. Find a battery to keep climbing.");
        return;
      }
      this.battery = Math.max(0, this.battery - dt);
    }
    if (this.basketStop > 0) {
      this.basketStop -= dt;
      return;
    }
    const speed =
      (60 + Math.min(this.wheel.rpm, 600) * 0.4) *
      (1 + 0.3 * this.levels.winch);
    this.p.y = Math.max(SURFACE, this.p.y - speed * dt);
    // The winch pulls straight up through Pip's own shaft; clear a basket-sized passage.
    for (const x of [this.p.x - 12, this.p.x + 12])
      for (const y of [this.p.y - 36, this.p.y - 12, this.p.y]) {
        const t = this.tile(x, y);
        if (t) {
          if (t.solid || t.rock) this.terrainRevision++;
          t.solid = false;
          t.rock = false;
        }
      }
    if (
      this.levels.winch &&
      this.depth > 0 &&
      Math.floor(this.depth / 50) < Math.floor(this.lastBasketDepth / 50)
    ) {
      this.basketStop = 1.1;
      this.say(
        `${Math.ceil(this.depth / 50) * 50}m basket stop. Q to step off.`,
      );
    }
    this.lastBasketDepth = this.depth;
    if (this.p.y <= SURFACE) {
      this.riding = false;
      const landing = [80, 112, 48, 144, 16, 464].find(
        (x) => this.world[0][Math.floor(x / 32)].solid,
      );
      if (landing === undefined)
        this.world[0][2] = {
          solid: true,
          hp: 1,
          variant: 0,
          ore: -1,
          rock: false,
        };
      this.terrainRevision++;
      this.p.x = landing ?? 80;
      this.p.vy = 0;
      this.p.grounded = true;
      this.deposit();
    }
  }
  private spawnEnemy(row: number) {
    row = Math.max(7, Math.min(298, row));
    const l = LAYERS[layerAt(row)];
    const type = l.enemies[Math.floor(this.rand() * l.enemies.length)];
    const x = (4 + Math.floor(this.rand() * 5)) * 32 + 16,
      y = SURFACE + row * 32 + 30;
    this.enemies.push({
      type,
      x,
      y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      hp: HP[type],
      time: this.rand() * 4,
      phase: 0,
      clock: 0,
      hurt: 0,
      dir: this.rand() < 0.5 ? -1 : 1,
    });
  }
  private hitEnemy(e: Enemy) {
    if (e.hurt > 0 || e.hp <= 0) return;
    e.hp--;
    e.hurt = 0.28;
    this.burst(e.x, e.y - 16, 7, "#c8b1e8");
    audio.play("dig", 0.5);
    if (e.hp <= 0) {
      this.spawnDrop(
        e.type === 2 ? 4 : this.rand() < 0.12 ? 13 : 0,
        e.x,
        e.y - 14,
        Math.max(0, (e.y - SURFACE) / 32),
      );
      this.popupAt(e.x, e.y - 28, "Bonk!", "#fff5e1");
    }
  }
  private updateEnemies(dt: number) {
    for (const e of this.enemies) {
      if (e.hp <= 0 || Math.abs(e.y - this.p.y) > 430) continue;
      e.time += dt;
      e.clock += dt;
      e.hurt = Math.max(0, e.hurt - dt);
      const dx = this.p.x - e.x,
        dy = this.p.y - e.y,
        distance = Math.hypot(dx, dy);
      if (e.type === 1) {
        const lamp = this.lanterns.find(
          (l) => Math.hypot(l.x - e.x, l.y - e.y) < 96,
        );
        if (lamp) {
          const d = Math.hypot(e.x - lamp.x, e.y - lamp.y) || 1;
          e.x += ((e.x - lamp.x) / d) * 65 * dt;
          e.y += ((e.y - lamp.y) / d) * 65 * dt;
          e.phase = 0;
        } else if (distance < 160) {
          e.dir = dx > 0 ? 1 : -1;
          if (e.phase === 0) {
            e.x += (dx / Math.max(distance, 1)) * 55 * dt;
            e.y += (dy / Math.max(distance, 1)) * 55 * dt;
            if (distance < 100 && e.clock > 1.2) {
              e.phase = 1;
              e.clock = 0;
            }
          } else if (e.phase === 1 && e.clock > 0.6) {
            e.phase = 2;
            e.clock = 0;
            e.vx = (dx / Math.max(distance, 1)) * 220;
            e.vy = (dy / Math.max(distance, 1)) * 220;
          } else if (e.phase === 2) {
            e.x += e.vx * dt;
            e.y += e.vy * dt;
            if (e.clock > 0.35) {
              e.phase = 0;
              e.clock = 0;
            }
          }
        } else {
          e.phase = 0;
          e.y += Math.sin(e.time) * dt * 4;
        }
      } else if (e.type === 3) {
        if (!e.phase && distance < 120) {
          e.phase = 1;
          e.clock = 0;
        }
        if (e.phase === 1) {
          e.x += Math.sign(dx) * 90 * dt;
          e.y += (dy * 1.3 + Math.sin(e.time * 7) * 60) * dt;
          e.dir = Math.sign(dx);
          if (e.clock > 3) e.phase = 2;
        }
        if (e.phase === 2) {
          e.x += (e.homeX - e.x) * dt * 2;
          e.y += (e.homeY - e.y) * dt * 2;
          if (Math.hypot(e.x - e.homeX, e.y - e.homeY) < 5) e.phase = 0;
        }
      } else if (e.type === 2) {
        // Follow the cave boundary with soil on the left, turning onto its walls.
        const directions = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ];
        let [wx, wy] = directions[e.phase];
        const cy = e.y - 14;
        if (this.solid(e.x + wx * 18, cy + wy * 18))
          e.phase = (e.phase + 1) % 4;
        else if (!this.solid(e.x + wy * 18, cy - wx * 18))
          e.phase = (e.phase + 3) % 4;
        [wx, wy] = directions[e.phase];
        if (!this.solid(e.x + wx * 25 * dt, cy + wy * 25 * dt)) {
          e.x += wx * 25 * dt;
          e.y += wy * 25 * dt;
        }
        if (wx) e.dir = wx;
        if (e.clock > 3) {
          this.hazards.push({ x: e.x, y: e.y + 10, life: 3, kind: "slime" });
          e.clock = 0;
        }
      } else {
        const speed = e.type === 0 ? 40 : 20;
        if (
          this.solid(e.x + e.dir * 18, e.y - 8) ||
          !this.solid(e.x + e.dir * 18, e.y + 4)
        )
          e.dir *= -1;
        if (!this.solid(e.x + e.dir * speed * dt, e.y - 8))
          e.x += e.dir * speed * dt;
        e.vy = Math.min(300, e.vy + 600 * dt);
        if (!this.solid(e.x, e.y + e.vy * dt)) e.y += e.vy * dt;
        else e.vy = 0;
        if (e.type === 4 && e.clock > 0.45) {
          this.hazards.push({ x: e.x, y: e.y - 3, life: 2.5, kind: "fire" });
          e.clock = 0;
        }
      }
      e.x = Math.max(20, Math.min(460, e.x));
      if (
        !this.riding &&
        this.p.hurt <= 0 &&
        Math.abs(this.p.x - e.x) < 24 &&
        Math.abs(this.p.y - e.y) < 30
      ) {
        if (this.p.vy > 60 && this.p.y < e.y - 11 && e.type !== 4) {
          this.hitEnemy(e);
          this.p.vy = -190;
        } else this.damage(e.type === 4 ? 2 : 1, e.x);
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const h of this.hazards) {
      h.life -= dt;
      if (h.kind === "slime" && !this.solid(h.x, h.y + 6)) h.y += 75 * dt;
      if (!this.riding && Math.hypot(h.x - this.p.x, h.y - this.p.y + 3) < 18)
        this.damage(1, h.x);
    }
    this.hazards = this.hazards.filter((h) => h.life > 0);
  }
  damage(amount: number, sourceX: number) {
    if (this.p.hurt > 0 || this.ended) return;
    this.hp = Math.max(0, this.hp - amount);
    this.p.hurt = 1.2;
    this.p.vx = Math.sign(this.p.x - sourceX || 1) * 140;
    this.p.vy = -130;
    audio.play("hurt");
    this.shake = 0.2;
    this.shakePower = 3;
    let weight = Math.ceil(this.load * 0.3);
    while (weight > 0 && this.inventory.length) {
      const d = this.inventory.pop()!;
      weight -= ITEMS[d.item].weight;
      this.spawnDrop(d.item, this.p.x, this.p.y - 10, this.depth, d.value, 0.8);
    }
    this.say("Ouch! Some treasure spilled. You can pick it back up.");
    if (this.hp <= 0) {
      this.inventory = [];
      this.finish(false);
    }
  }
  earthquake() {
    this.terrainRevision++;
    if (this.ended || !this.started) return;
    this.quakes++;
    this.shake = 2.5;
    this.shakePower = 6;
    audio.play("quake");
    audio.play("bell");
    this.say(`Earthquake! Round settled. Fresh treasure in the deep.`, 6);
    const row = Math.min(286, Math.max(3, this.depth));
    let crumbled = 0;
    const target = 8 + Math.floor(this.rand() * 7);
    for (let i = 0; i < 200 && crumbled < target; i++) {
      const y = row + Math.floor(this.rand() * 12),
        x = Math.floor(this.rand() * 15);
      const t = this.world[y]?.[x];
      if (t?.solid) {
        t.solid = false;
        t.rock = false;
        crumbled++;
        this.burst(
          x * 32 + 16,
          SURFACE + y * 32 + 16,
          4,
          LAYERS[layerAt(y)].color,
        );
      }
    }
    this.spawnEnemy(row + 4);
    if (this.rand() > 0.5) this.spawnEnemy(row + 7);
    for (let i = 0; i < 6; i++) {
      const dug: { x: number; y: number }[] = [];
      for (
        let y = Math.max(3, this.depth - 8);
        y < Math.min(300, this.depth + 12);
        y++
      )
        for (let x = 0; x < 15; x++)
          if (
            !this.world[y][x].solid &&
            Math.hypot(
              x * 32 + 16 - this.p.x,
              SURFACE + y * 32 + 16 - this.p.y,
            ) > 55
          )
            dug.push({ x, y });
      if (dug.length) {
        const c = dug[Math.floor(this.rand() * dug.length)],
          l = LAYERS[layerAt(c.y)];
        this.world[c.y][c.x] = {
          solid: true,
          hp: l.hp,
          rock: false,
          variant: 0,
          ore: l.loot[Math.floor(this.rand() * l.loot.length)],
        };
      }
    }
  }
  buyLevels(levels: Levels) {
    const extra = levels.armor - this.levels.armor;
    this.levels = { ...levels };
    this.maxHP = 3 + levels.armor;
    this.hp = Math.min(this.maxHP, this.hp + extra);
  }
  finish(safe: boolean) {
    if (this.ended || (safe && !this.atCamp)) return;
    if (safe) this.deposit();
    this.ended = true;
    this.clearInput();
    this.onEnd({
      id: Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) =>
        n.toString(16).padStart(8, "0"),
      ).join(""),
      mode: this.mode,
      score: this.hoard + this.maxDepth * 5,
      depth: this.maxDepth,
      hoard: this.hoard,
      best: this.best,
      date: this.date,
      seedHash: this.seedHash,
      wheel: this.wheel.practice
        ? "Practice · 300 rpm"
        : this.wheel.active
          ? `Active · ${Math.round(this.wheel.rpm)} rpm`
          : this.wheel.lost
            ? "Signal lost"
            : "Resting",
    });
  }
  private burst(
    x: number,
    y: number,
    count: number,
    color: string,
    item?: number,
  ) {
    for (let i = 0; i < count; i++)
      this.particles.push({
        x,
        y,
        vx: (this.rand() - 0.5) * 150,
        vy: -50 - this.rand() * 150,
        life: 0.4 + this.rand() * 0.6,
        color,
        item,
      });
    if (this.particles.length > 180)
      this.particles.splice(0, this.particles.length - 180);
  }
  private popup(text: string, color: string) {
    this.popupAt(this.p.x, this.p.y - 40, text, color);
  }
  private popupAt(x: number, y: number, text: string, color: string) {
    this.popups.push({ x, y, text, color, life: 1.1 });
  }
  private updateEffects(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += dt * 270;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 25 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }
  private sprite(
    c: CanvasRenderingContext2D,
    path: string,
    frame: number,
    fw: number,
    fh: number,
    x: number,
    y: number,
    w: number,
    h: number,
    flip = false,
  ) {
    const im = this.images[path];
    if (!im) return;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (flip) c.scale(-1, 1);
    c.drawImage(im, frame * fw, 0, fw, fh, -w / 2, -h, w, h);
    c.restore();
  }
  private icon(
    c: CanvasRenderingContext2D,
    item: number,
    x: number,
    y: number,
    size = 20,
  ) {
    c.drawImage(
      this.images["items/items.png"],
      item * 32,
      0,
      32,
      32,
      Math.round(x - size / 2),
      Math.round(y - size / 2),
      size,
      size,
    );
  }
  private panel(
    c: CanvasRenderingContext2D,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    border = 6,
  ) {
    const im = this.images[`ui/${key}.png`],
      sw = im.width,
      sh = im.height;
    const dx = [x, x + border, x + w - border],
      dy = [y, y + border, y + h - border];
    const sx = [0, border, sw - border],
      sy = [0, border, sh - border];
    const dw = [border, w - 2 * border, border],
      dh = [border, h - 2 * border, border];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++)
        c.drawImage(
          im,
          sx[i],
          sy[j],
          i === 1 ? sw - border * 2 : border,
          j === 1 ? sh - border * 2 : border,
          dx[i],
          dy[j],
          dw[i],
          dh[j],
        );
  }
  private text(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size = 10,
    color = "#fff5e1",
    align: CanvasTextAlign = "left",
  ) {
    c.font = `${size}px "Pixelify Sans"`;
    c.textAlign = align;
    c.lineWidth = 3;
    c.strokeStyle = "#1e1218";
    c.strokeText(text, x, y);
    c.fillStyle = color;
    c.fillText(text, x, y);
  }
  private drawTerrain(
    target: CanvasRenderingContext2D,
    start: number,
    end: number,
  ) {
    if (
      this.terrainRow !== start ||
      this.terrainCachedRevision !== this.terrainRevision
    ) {
      const c = this.terrainContext;
      c.clearRect(0, 0, WIDTH, 384);
      for (let row = start; row <= Math.min(299, start + 11); row++)
        for (let col = 0; col < 15; col++) {
          const t = this.world[row][col],
            layer = layerAt(row),
            x = col * 32,
            y = (row - start) * 32;
          c.drawImage(
            this.images["tiles/tiles.png"],
            (t.solid ? t.variant : 2) * 32,
            layer * 32,
            32,
            32,
            x,
            y,
            32,
            32,
          );
          if (t.solid) {
            if (t.ore >= 0) {
              c.drawImage(
                this.images[
                  `props/${t.ore < 4 ? "ore_seeds" : "ore_gems"}.png`
                ],
                x,
                y,
                32,
                32,
              );
            }
            if (t.rock)
              c.drawImage(this.images["props/rock_cracked.png"], x, y, 32, 32);
            if (t.hp < LAYERS[layer].hp) {
              c.strokeStyle = "#1e1218";
              c.lineWidth = 1;
              c.beginPath();
              c.moveTo(x + 12, y + 2);
              c.lineTo(x + 18, y + 15);
              c.lineTo(x + 12, y + 25);
              c.stroke();
            }
          } else {
            c.fillStyle = "#160e18b8";
            if (this.world[row - 1]?.[col]?.solid) c.fillRect(x, y, 32, 3);
            if (this.world[row]?.[col - 1]?.solid) c.fillRect(x, y, 3, 32);
            if (this.world[row]?.[col + 1]?.solid) c.fillRect(x + 29, y, 3, 32);
            if (this.world[row + 1]?.[col]?.solid) {
              c.fillRect(x, y + 29, 32, 3);
              c.fillStyle = "#e3a671";
              c.fillRect(x, y + 31, 32, 1);
            }
          }
        }

      this.terrainRow = start;
      this.terrainCachedRevision = this.terrainRevision;
    }
    target.drawImage(this.terrainCanvas, 0, SURFACE + start * 32);
    if (this.levels.lamp)
      for (let row = start; row <= end; row++)
        for (let col = 0; col < 15; col++) {
          const t = this.world[row][col];
          if (
            t.solid &&
            t.ore >= 0 &&
            Math.sin(this.seconds * 3 + col + row) > 0.92
          ) {
            const x = col * 32,
              y = SURFACE + row * 32;
            target.fillStyle = "#fff5e1";
            target.fillRect(x + 16, y + 8, 2, 4);
            target.fillRect(x + 15, y + 9, 4, 2);
          }
        }
  }
  draw() {
    if (!this.started) return;
    const c = this.canvas.getContext("2d", { alpha: false })!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#171321";
    c.fillRect(0, 0, WIDTH, HEIGHT);
    const camera = Math.round(this.camera);
    const margin = Math.max(0, (WIDTH - this.visibleWidth) / 2);
    const shift = Math.round(
      Math.max(-margin, Math.min(margin, WIDTH / 2 - this.p.x)),
    );
    const sx =
      this.shake > 0 && !this.reducedMotion
        ? (this.rand() - 0.5) * this.shakePower * 2
        : 0;
    const sy =
      this.shake > 0 && !this.reducedMotion
        ? (this.rand() - 0.5) * this.shakePower * 2
        : 0;
    c.save();
    c.translate(Math.round(sx + shift), Math.round(sy - camera));
    this.drawSurface(c);
    const start = Math.max(0, Math.floor((camera - SURFACE) / 32)),
      end = Math.min(299, Math.ceil((camera + HEIGHT - SURFACE) / 32));
    this.drawTerrain(c, start, end);
    for (const l of LAYERS.slice(1)) {
      const y = SURFACE + l.from * 32;
      if (y > camera - 80 && y < camera + HEIGHT + 80) {
        c.drawImage(this.images["props/beam.png"], 140, y - 48, 119, 72);
        this.text(
          c,
          `${l.name} · ${l.from}m`,
          240,
          y - 40,
          10,
          l.color,
          "center",
        );
      }
    }
    for (const l of this.lanterns)
      if (Math.abs(l.y - camera - HEIGHT / 2) < 220)
        c.drawImage(
          this.images["props/lantern.png"],
          l.x - 10,
          l.y - 38,
          20,
          51,
        );
    for (const d of this.drops)
      if (d.y > camera - 30 && d.y < camera + HEIGHT + 30)
        this.icon(
          c,
          d.item,
          d.x,
          d.y + Math.sin(this.seconds * 4 + d.x) * 1.5,
          22,
        );
    for (const h of this.hazards) {
      c.globalAlpha = Math.min(1, h.life);
      // Use the creatures' original pixels so hazards cannot be mistaken for loot.
      if (h.kind === "fire") {
        const frame = Math.floor(this.seconds * 8) % 3;
        c.drawImage(
          this.images["enemies/magma_slug.png"],
          frame * 72 + 37,
          31,
          27,
          29,
          Math.round(h.x - 10),
          Math.round(h.y - 17),
          20,
          21,
        );
      } else {
        c.drawImage(
          this.images["enemies/glow_worm.png"],
          12,
          44,
          22,
          16,
          Math.round(h.x - 9),
          Math.round(h.y - 7),
          18,
          10,
        );
      }
    }
    c.globalAlpha = 1;
    for (const e of this.enemies) {
      if (e.y < camera - 20 || e.y > camera + HEIGHT + 80) continue;
      c.globalAlpha = e.hurt > 0 ? 0.5 : e.type === 1 ? 0.85 : 1;
      const frames = [0, 1, 2, 1],
        f =
          e.type === 1
            ? e.phase
            : e.type === 3
              ? frames[Math.floor(e.time * 8) % 4]
              : Math.floor(e.time * 6) % 3;
      this.sprite(
        c,
        `enemies/${ENEMIES[e.type]}.png`,
        f,
        72,
        64,
        e.x,
        e.y + 2,
        52,
        46,
        e.dir > 0,
      );
      if (e.type === 1 && e.phase === 1)
        this.text(c, "!", e.x, e.y - 41, 16, "#ffce40", "center");
    }
    c.globalAlpha = 1;
    if (!this.p.hurt || Math.floor(this.p.hurt * 15) % 2 === 0) {
      let anim = "ham_idle",
        frame = Math.floor(this.seconds * 6) % 4;
      if (this.riding) {
        anim = "ham_ride";
        c.strokeStyle = "#d2a366";
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(this.p.x, Math.max(0, camera));
        c.lineTo(this.p.x, this.p.y - 45);
        c.stroke();
      } else if (this.p.hurt > 0.6) {
        anim = "ham_hurt";
        frame = this.hp <= 0 ? 2 : this.p.hurt > 1 ? 0 : 1;
      } else if (this.digAnimation > 0) {
        anim = this.diggingDown ? "ham_dig_down" : "ham_dig";
        frame = Math.floor(this.seconds * 12) % 4;
      } else if (!this.p.grounded) {
        anim = "ham_jump";
        frame = this.p.vy < -80 ? 1 : this.p.vy < 80 ? 2 : 3;
      } else if (Math.abs(this.p.vx) > 5) {
        anim = "ham_walk";
        frame = Math.floor(this.seconds * 10) % 4;
      }
      const wobble = this.reducedMotion
        ? 0
        : Math.sin(this.seconds * 11) * 0.008 * this.stage;
      const hop = this.reducedMotion
        ? 0
        : Math.sin((this.p.hop / 0.22) * Math.PI) * 4;
      const squash =
        !this.reducedMotion && this.digAnimation > 0
          ? Math.sin(this.seconds * 16) * 0.025
          : 0;
      this.sprite(
        c,
        `hamster/${anim}.png`,
        frame,
        80,
        80,
        this.p.x,
        this.p.y + 2 - hop,
        64 * (1 + this.stage * 0.06 + wobble + squash),
        64 * (1 - squash),
        this.p.facing < 0,
      );
    }
    for (const p of this.particles) {
      c.globalAlpha = Math.min(1, p.life * 2);
      if (p.item !== undefined) this.icon(c, p.item, p.x, p.y, 12);
      else {
        c.fillStyle = p.color;
        c.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
      }
    }
    c.globalAlpha = 1;
    c.restore();
    this.drawDarkness(c, camera, shift, start, end);
    c.save();
    c.translate(shift, -camera);
    for (const p of this.popups) {
      c.globalAlpha = Math.min(1, p.life * 2);
      this.text(c, p.text, p.x, p.y, 12, p.color, "center");
    }
    c.restore();
    this.drawHUD(c, margin);
  }
  private drawSurface(c: CanvasRenderingContext2D) {
    if (this.camera > SURFACE + 80) return;
    c.fillStyle = "#171321";
    c.fillRect(-80, 0, 640, SURFACE);
    c.fillStyle = "#7e728b";
    for (let i = 0; i < 35; i++)
      c.fillRect(hash(`star${i}`) % 480, hash(`y${i}`) % 100, 1, 1);
    // Original tile and prop art form the camp, with no stand-in scenery.
    c.drawImage(this.images["props/beam.png"], 181, 107, 119, 72);
    const wheelArt =
      this.images[
        this.wheel.active ? "props/wheel_on.png" : "props/wheel_off.png"
      ];
    c.drawImage(
      wheelArt,
      302,
      SURFACE - wheelArt.height,
      wheelArt.width,
      wheelArt.height,
    );
    if (this.wheel.active && !this.reducedMotion) {
      const spin = (this.seconds * Math.min(this.wheel.rpm, 600)) / 60;
      c.save();
      c.translate(372, 133);
      c.rotate(spin * 2 * Math.PI);
      c.drawImage(
        this.images["props/wheel_on.png"],
        62,
        36,
        16,
        16,
        -8,
        -8,
        16,
        16,
      );
      c.restore();
    }
    c.drawImage(this.images["props/lantern.png"], 207, 88, 15, 38);
    this.icon(c, 15, 83, 143, 46);
    this.text(c, "HOARD", 83, 111, 10, "#ffce40", "center");
    this.text(c, "WINCH", 350, 87, 10, "#c7b2a2", "center");
    this.text(c, "SURFACE CAMP", 240, 64, 14, "#fff5e1", "center");
    this.text(c, "Dig down ↓", 240, 193, 10, "#ffce40", "center");
    if (this.wheel.active) {
      c.fillStyle = "#ffce40";
      for (let i = 0; i < 3; i++)
        c.fillRect(
          389 + Math.sin(this.seconds * 7 + i) * 5,
          124 + Math.cos(this.seconds * 9 + i) * 8,
          2,
          2,
        );
    }
  }
  private drawDarkness(
    c: CanvasRenderingContext2D,
    camera: number,
    shift: number,
    start: number,
    end: number,
  ) {
    if (this.depth < 20) return;
    const m = this.maskContext;
    m.clearRect(0, 0, WIDTH, HEIGHT);
    const ambient = Math.max(0.25, 1 - (this.depth / 300) * 0.75),
      alpha = Math.max(0, 1 - ambient - (this.wheel.active ? 0.1 : 0));
    m.globalCompositeOperation = "source-over";
    m.fillStyle = `rgba(8,5,17,${Math.min(0.88, alpha)})`;
    m.fillRect(0, 0, WIDTH, HEIGHT);
    m.globalCompositeOperation = "destination-out";
    const light = (x: number, y: number, radius: number) =>
      m.drawImage(
        this.lightStamp,
        Math.round(x - radius),
        Math.round(y - radius),
        Math.round(radius * 2),
        Math.round(radius * 2),
      );
    light(
      this.p.x + shift,
      this.p.y - camera - 29,
      (110 + this.levels.lamp * 20) * (this.wheel.active ? 1.1 : 1),
    );
    for (const l of this.lanterns)
      if (Math.abs(l.y - camera - 135) < 230)
        light(l.x + shift, l.y - camera, 96);
    for (const e of this.enemies)
      if (e.type === 2 && Math.abs(e.y - camera - 135) < 200)
        light(e.x + shift, e.y - camera - 20, 62);
    if (end >= 260) {
      if (
        this.magmaRow !== start ||
        this.magmaRevision !== this.terrainRevision
      ) {
        const glow = this.magmaContext;
        glow.clearRect(0, 0, WIDTH, 384);
        for (
          let r = Math.max(260, start);
          r <= Math.min(299, start + 11);
          r += 2
        )
          for (let col = 0; col < 15; col += 3)
            if (this.world[r][col].solid)
              glow.drawImage(
                this.lightStamp,
                col * 32 + 16 - 40,
                (r - start) * 32 + 16 - 40,
                80,
                80,
              );
        this.magmaRow = start;
        this.magmaRevision = this.terrainRevision;
      }
      m.globalAlpha = this.reducedMotion
        ? 1
        : 0.9 + Math.sin(this.seconds * 8) * 0.1;
      m.drawImage(this.magmaCanvas, shift, SURFACE + start * 32 - camera);
      m.globalAlpha = 1;
    }
    m.globalCompositeOperation = "source-over";
    c.drawImage(this.mask, 0, 0);
  }
  private drawHUD(c: CanvasRenderingContext2D, margin: number) {
    const left = margin + 6,
      right = WIDTH - margin - 6;
    const remaining = this.wheel.updated
      ? Math.max(
          0,
          (1 - this.wheel.progress) * (this.wheel.practice ? 90 : 600),
        )
      : 600;
    const timer =
      this.wheel.lost || !this.wheel.updated
        ? "—"
        : `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, "0")}`;
    this.text(
      c,
      `${this.wheel.practice ? "PRACTICE" : !this.wheel.updated ? "CONNECTING" : this.wheel.lost ? "SIGNAL LOST" : this.wheel.active ? "WHEEL ACTIVE" : "WHEEL RESTING"} · ${Math.round(this.wheel.rpm)} rpm`,
      left,
      13,
      9,
      this.wheel.active ? "#beffa0" : "#e0c7ab",
    );
    this.text(c, `ROUND ${timer}   ${this.depth}m`, left, 25, 10);
    const w = this.visibleWidth < 390 ? 96 : 116;
    this.panel(c, "cheek_meter", right - w, 4, w, 32);
    const ratio = this.load / this.capacity;
    c.fillStyle = ratio < 0.6 ? "#91d453" : ratio < 0.9 ? "#ffce40" : "#f27868";
    c.fillRect(right - w + 33, 14, Math.round((w - 43) * ratio), 8);
    this.sprite(
      c,
      "hamster/ham_cheeks.png",
      this.stage,
      80,
      80,
      right - w + 17,
      32,
      36,
      36,
    );
    this.text(
      c,
      `${this.load}/${this.capacity}`,
      right - w / 2 + 12,
      32,
      8,
      "#fff5e1",
      "center",
    );
    this.panel(c, "hud_bar", left, HEIGHT - 32, 172, 27);
    for (let i = 0; i < this.maxHP; i++) {
      c.globalAlpha = i < this.hp ? 1 : 0.18;
      this.icon(c, 13, left + 14 + i * 15, HEIGHT - 18, 16);
    }
    c.globalAlpha = 1;
    this.icon(c, 0, left + 112, HEIGHT - 18, 16);
    this.text(c, fmt(this.hoard), left + 123, HEIGHT - 14, 10, "#ffce40");
    this.panel(c, "depth_gauge", right - 13, 66, 13, 116, 4);
    const gy = 73 + (this.depth / 300) * 100;
    c.fillStyle = "#ffce40";
    c.fillRect(right - 11, Math.round(gy), 9, 3);
    if (this.riding)
      this.text(c, "↑ HOME", 240, HEIGHT - 16, 12, "#beffa0", "center");
    if (this.battery > 0) {
      this.icon(c, 14, right - 53, HEIGHT - 18, 15);
      this.text(
        c,
        `${Math.ceil(this.battery)}s`,
        right - 43,
        HEIGHT - 14,
        9,
        "#ffce40",
      );
    }
  }
}
