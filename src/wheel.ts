export const FALLBACK_CLOCK = { genesis: 1793022600, duration: 600 };
export interface Wheel {
  active: boolean;
  lost: boolean;
  rpm: number;
  progress: number;
  height: number;
  settledRound: number | null;
  minted: string;
  practice: boolean;
  updated: number;
  genesis: number;
  duration: number;
}
export const initialWheel = (): Wheel => ({
  active: false,
  lost: false,
  rpm: 0,
  progress: 0,
  height: 0,
  settledRound: null,
  minted: "Connecting…",
  practice: false,
  updated: 0,
  ...FALLBACK_CLOCK,
});
export function roundClock(now: number, genesis: number, duration: number) {
  const currentRound = Math.floor((now - genesis) / duration) + 1;
  const remaining = Math.max(
    0,
    Math.min(duration, genesis + currentRound * duration - now),
  );
  const seconds = Math.min(duration, Math.ceil(remaining));
  return {
    currentRound,
    remaining,
    label: `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`,
  };
}
export function parseStatus(json: unknown, old: Wheel): Wheel {
  const envelope = json as Record<string, any>;
  const d = envelope?.data ?? envelope;
  const core = d?.coreStatus ?? d?.measurement?.coreStatus ?? d?.core?.status;
  const raw = d?.builder?.anchor?.settledThroughRound;
  const settled = raw != null && /^\d+$/.test(String(raw)) ? Number(raw) : NaN;
  if (
    !d ||
    !["ACTIVE", "IDLE", "COUNTER_FAULT"].includes(core) ||
    !Number.isSafeInteger(settled)
  )
    throw new Error("Wheel signal unavailable");
  const height = Number(d?.builder?.projected?.blockHeight ?? old.height);
  return {
    ...old,
    active: core === "ACTIVE",
    lost: core === "COUNTER_FAULT",
    rpm: Math.max(0, Number(d.measurement?.rpmMilli ?? 0) / 1000) || 0,
    // Projected blocks are telemetry only, never settlement or countdown inputs.
    progress:
      Math.max(
        0,
        Math.min(1, Number(d?.builder?.projected?.blockProgress ?? 0) / 1e9),
      ) || 0,
    height: Number.isFinite(height) ? height : old.height,
    settledRound: Math.max(old.settledRound ?? 0, settled),
    updated: Date.now(),
    practice: false,
  };
}
export function didSettle(before: Wheel, after: Wheel) {
  return (
    !before.lost &&
    !after.lost &&
    before.practice === after.practice &&
    before.settledRound !== null &&
    after.settledRound !== null &&
    after.settledRound > before.settledRound
  );
}
export function formatMinted(raw: unknown) {
  if (raw == null || !/^\d+$/.test(String(raw))) return "Unavailable";
  const units = BigInt(String(raw));
  const decimal = 10n ** 18n;
  for (const [scale, suffix] of [
    [10n ** 12n, "T"],
    [10n ** 9n, "B"],
    [10n ** 6n, "M"],
    [1000n, "K"],
    [1n, ""],
  ] as const) {
    if (units >= scale * decimal || scale === 1n) {
      const cents = (units * 100n + (scale * decimal) / 2n) / (scale * decimal);
      return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}${suffix} SQK`;
    }
  }
  return "Unavailable";
}
export class WheelService {
  state = initialWheel();
  private timers: ReturnType<typeof setInterval>[] = [];
  private requests = new Set<AbortController>();
  private dead = false;
  private generation = 0;
  private practiceStart = 0;
  private clock = { ...FALLBACK_CLOCK };
  private coreRequested = false;
  constructor(private change: (wheel: Wheel, quake: boolean) => void) {}
  start(practice: boolean) {
    this.stop();
    this.dead = false;
    this.state = { ...initialWheel(), ...this.clock };
    // Clear both React and engine power synchronously, including Practice -> Adventure.
    this.change(this.state, false);
    if (practice) {
      this.practiceStart = Date.now();
      const tick = () => {
        const seconds = (Date.now() - this.practiceStart) / 1000;
        const after: Wheel = {
          ...this.state,
          active: true,
          lost: false,
          rpm: 300,
          progress: (seconds % 90) / 90,
          height: Math.floor(seconds / 90),
          settledRound: Math.floor(seconds / 90),
          minted: "Practice · offline",
          practice: true,
          genesis: this.practiceStart / 1000,
          duration: 90,
          updated: Date.now(),
        };
        this.publish(after);
      };
      tick();
      this.timers.push(setInterval(tick, 250));
    } else {
      void this.status();
      void this.economy();
      if (!this.coreRequested) {
        this.coreRequested = true;
        void this.core();
      }
      this.timers.push(
        setInterval(() => void this.status(), 5000),
        setInterval(() => void this.economy(), 30000),
      );
    }
  }
  private publish(after: Wheel) {
    const before = this.state;
    const quake = didSettle(before, after);
    this.state = after;
    if (quake)
      console.info("[Squeek Deep] settlement", {
        from: before.settledRound,
        to: after.settledRound,
        active: after.active,
        practice: after.practice,
        detectedAt: new Date().toISOString(),
      });
    this.change(after, quake);
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
      this.publish(parseStatus(d, this.state));
    } catch {
      if (!this.dead && generation === this.generation) {
        // Preserve the last good timestamp; recovery establishes a new baseline silently.
        this.state = { ...this.state, active: false, lost: true, rpm: 0 };
        this.change(this.state, false);
      }
    }
  }
  private async core() {
    try {
      const envelope = await this.fetchJSON("core");
      const config = (envelope.data ?? envelope)?.configuration;
      const genesis = Number(config?.genesisTimestamp),
        duration = Number(config?.roundDuration);
      if (
        Number.isSafeInteger(genesis) &&
        genesis > 0 &&
        Number.isSafeInteger(duration) &&
        duration > 0
      )
        this.clock = { genesis, duration };
      if (!this.dead && !this.state.practice) {
        this.state = { ...this.state, ...this.clock };
        this.change(this.state, false);
      }
    } catch {
      /* The supplied genesis and duration remain the clock when unavailable. */
    }
  }
  private async economy() {
    const generation = this.generation;
    try {
      const e = await this.fetchJSON("economy/state");
      if (this.dead || generation !== this.generation) return;
      this.state = {
        ...this.state,
        minted: formatMinted((e.data ?? e)?.supply?.totalMintedBaseUnits),
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
