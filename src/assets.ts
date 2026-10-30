export const A = "./assets/";
const imagePaths = [
  "hamster/ham_idle.png",
  "hamster/ham_walk.png",
  "hamster/ham_dig.png",
  "hamster/ham_dig_down.png",
  "hamster/ham_jump.png",
  "hamster/ham_hurt.png",
  "hamster/ham_ride.png",
  "hamster/ham_cheeks.png",
  "enemies/root_beetle.png",
  "enemies/mole_shade.png",
  "enemies/glow_worm.png",
  "enemies/crystal_bat.png",
  "enemies/magma_slug.png",
  "tiles/tiles.png",
  "items/items.png",
  "props/ore_seeds.png",
  "props/ore_gems.png",
  "props/rock_cracked.png",
  "props/wheel_on.png",
  "props/wheel_off.png",
  "props/lantern.png",
  "props/beam.png",
  "props/basket_ride_alt.png",
  "ui/hud_bar.png",
  "ui/shop_panel.png",
  "ui/cheek_meter.png",
  "ui/btn_gold.png",
  "ui/btn_green.png",
  "ui/btn_wood.png",
  "ui/depth_gauge.png",
  "ui/slot.png",
];
export type Images = Record<string, HTMLImageElement>;
export async function loadImages(): Promise<Images> {
  const entries = await Promise.all(
    imagePaths.map(
      (path) =>
        new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve([path, im]);
          im.onerror = () =>
            reject(new Error(`Could not load ${path}. Reload to try again.`));
          im.src = A + path;
        }),
    ),
  );
  return Object.fromEntries(entries);
}
export class AudioBank {
  private buffers = new Map<string, AudioBuffer>();
  private context?: AudioContext;
  private music?: HTMLAudioElement;
  unlocked = false;
  muted = false;
  musicVolume = 0.4;
  sfxVolume = 0.65;
  unlock() {
    if (this.unlocked) {
      void this.context?.resume().catch(() => {});
      return;
    }
    this.unlocked = true;
    try {
      this.context = new AudioContext();
      void this.context.resume().catch(() => {});
      for (const name of [
        "dig",
        "break",
        "pickup_seed",
        "pickup_gem",
        "squeak",
        "hurt",
        "coin",
        "upgrade",
        "click",
        "bell",
        "quake",
        "power_on",
        "power_off",
      ]) {
        void fetch(`${A}audio/${name}.ogg`)
          .then((r) => r.arrayBuffer())
          .then((b) => this.context!.decodeAudioData(b))
          .then((b) => this.buffers.set(name, b))
          .catch(() => {});
      }
      this.music = new Audio(`${A}audio/music_loop.ogg`);
      this.music.loop = true;
      this.sync();
    } catch {
      /* Audio is optional; controls still work if the browser disables it. */
    }
  }
  sync() {
    if (this.music) {
      this.music.volume = this.musicVolume;
      if (this.muted) this.music.pause();
      else if (this.unlocked) void this.music.play().catch(() => {});
    }
  }
  play(name: string, gain = 1) {
    if (this.muted || !this.context || !this.unlocked) return;
    const buffer = this.buffers.get(name);
    const volume = this.context.createGain();
    volume.gain.value = this.sfxVolume * gain;
    volume.connect(this.context.destination);
    if (buffer) {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(volume);
      source.start();
    } else {
      const o = this.context.createOscillator();
      o.type = "triangle";
      o.frequency.value = name === "hurt" ? 120 : 620;
      volume.gain.setValueAtTime(
        0.045 * this.sfxVolume,
        this.context.currentTime,
      );
      volume.gain.exponentialRampToValueAtTime(
        0.001,
        this.context.currentTime + 0.08,
      );
      o.connect(volume);
      o.start();
      o.stop(this.context.currentTime + 0.08);
    }
  }
}
export const audio = new AudioBank();
