export interface Wheel {
  active: boolean;
  lost: boolean;
  rpm: number;
  progress: number;
  height: number;
  minted: string;
  practice: boolean;
  updated: number;
}
export const initialWheel = (): Wheel => ({
  active: false,
  lost: false,
  rpm: 0,
  progress: 0,
  height: 0,
  minted: "Connecting…",
  practice: false,
  updated: 0,
});
export function parseStatus(json: unknown, old: Wheel): Wheel {
  const envelope = json as Record<string, any>;
  const d = envelope?.data ?? envelope;
  const core = d?.coreStatus ?? d?.measurement?.coreStatus ?? d?.core?.status;
  const p =
    Number(
      d?.builder?.projected?.blockProgress ??
        d?.builder?.blockProgress ??
        d?.blockProgress ??
        0,
    ) / 1e9;
  const height = Number(d?.builder?.projected?.blockHeight ?? old.height);
  if (!d || !["ACTIVE", "IDLE", "COUNTER_FAULT"].includes(core))
    throw new Error("Wheel signal unavailable");
  return {
    ...old,
    active: core === "ACTIVE",
    lost: core === "COUNTER_FAULT",
    rpm: Math.max(0, Number(d.measurement?.rpmMilli ?? 0) / 1000),
    progress: Math.max(0, Math.min(1, p || 0)),
    height: Number.isFinite(height) ? height : old.height,
    updated: Date.now(),
    practice: false,
  };
}
export function didSettle(before: Wheel, after: Wheel) {
  return (
    !!before.updated &&
    (after.height > before.height ||
      (before.progress > 0.9 && after.progress < 0.1))
  );
}
export class WheelService {
  state = initialWheel();
  private timers: ReturnType<typeof setInterval>[] = [];
  private requests = new Set<AbortController>();
  private dead = false;
  private generation = 0;
  private practiceStart = 0;
  constructor(private change: (wheel: Wheel, quake: boolean) => void) {}
  start(practice: boolean) {
    this.stop();
    this.dead = false;
    this.state = initialWheel();
    if (practice) {
      this.practiceStart = Date.now();
      const tick = () => {
        const seconds = (Date.now() - this.practiceStart) / 1000;
        const after = {
          active: true,
          lost: false,
          rpm: 300,
          progress: (seconds % 90) / 90,
          height: Math.floor(seconds / 90),
          minted: "Practice · offline",
          practice: true,
          updated: Date.now(),
        };
        const quake = didSettle(this.state, after);
        this.state = after;
        this.change(after, quake);
      };
      tick();
      this.timers.push(setInterval(tick, 250));
    } else {
      void this.status();
      void this.economy();
      this.timers.push(
        setInterval(() => void this.status(), 5000),
        setInterval(() => void this.economy(), 30000),
      );
    }
  }
  private async fetchJSON(path: string) {
    if (typeof navigator !== "undefined" && navigator.onLine === false)
      throw new Error("Offline");
    const c = new AbortController();
    this.requests.add(c);
    const timer = setTimeout(() => c.abort(), 4000);
    try {
      const r = await fetch(`https://api.squeekchain.com/v1/${path}`, {
        signal: c.signal,
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`Wheel HTTP ${r.status}`);
      return await r.json();
    } finally {
      clearTimeout(timer);
      this.requests.delete(c);
    }
  }
  private async status() {
    const generation = this.generation;
    try {
      const d = await this.fetchJSON("status");
      if (this.dead || generation !== this.generation) return;
      const after = parseStatus(d, this.state);
      const quake = didSettle(this.state, after);
      this.state = after;
      this.change(after, quake);
    } catch {
      if (!this.dead && generation === this.generation) {
        this.state = {
          ...this.state,
          active: false,
          lost: true,
          rpm: 0,
          updated: Date.now(),
        };
        this.change(this.state, false);
      }
    }
  }
  private async economy() {
    const generation = this.generation;
    try {
      const e = await this.fetchJSON("economy/state");
      if (this.dead || generation !== this.generation) return;
      const n = (e.data ?? e)?.supply?.totalMintedBaseUnits;
      this.state = {
        ...this.state,
        minted:
          n != null && /^\d+$/.test(String(n))
            ? BigInt(n).toLocaleString("en-US")
            : "Unavailable",
      };
      this.change(this.state, false);
    } catch {
      if (!this.dead && generation === this.generation) {
        this.state = { ...this.state, minted: "Unavailable" };
        this.change(this.state, false);
      }
    }
  }
  stop() {
    this.generation++;
    this.dead = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
    this.requests.forEach((c) => c.abort());
    this.requests.clear();
  }
}
