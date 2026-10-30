import { A } from "./assets";
import { fmt, type Entry } from "./model";
export async function makeShareCard(entry: Entry): Promise<Blob> {
  await document.fonts.load('32px "Pixelify Sans"');
  const bg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () =>
      reject(new Error("Share artwork could not load. Reload and try again."));
    im.src = `${A}share/share_bg.png`;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const c = canvas.getContext("2d")!;
  c.imageSmoothingEnabled = false;
  c.drawImage(bg, 0, 0, 1200, 630);
  const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    color = "#fff5e1",
  ) => {
    c.font = `${size}px "Pixelify Sans"`;
    c.strokeStyle = "#1e1218";
    c.lineWidth = 3;
    c.strokeText(s, x, y);
    c.fillStyle = color;
    c.fillText(s, x, y);
  };
  text("SQUEEK DEEP", 490, 122, 72, "#ffce40");
  text("DEPTH", 490, 192, 26, "#e8c59d");
  text("HOARD", 815, 192, 26, "#e8c59d");
  text(`${entry.depth}m`, 490, 268, 64);
  text(fmt(entry.hoard), 815, 268, 64, "#ffce40");
  text(`Best haul  ${fmt(entry.best)} seeds`, 490, 342, 32);
  text(`Wheel  ${entry.wheel}`, 490, 397, 28, "#beffa0");
  text(
    `${entry.mode === "daily" ? "Daily mine" : entry.mode === "practice" ? "Practice · unranked" : "Adventure"}  ·  ${entry.date}`,
    490,
    455,
    26,
  );
  text("Powered by a real hamster wheel.", 490, 527, 26, "#e8c59d");
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Could not create the image. Try again.")),
      "image/png",
    ),
  );
}
export function downloadCard(blob: Blob, entry: Entry) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `squeek-deep-${entry.depth}m-${entry.date}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function copyCard(blob: Blob) {
  if (!navigator.clipboard?.write || !window.ClipboardItem)
    throw new Error(
      "Image copying is unavailable here. Download the PNG instead.",
    );
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
export function tweetURL(entry: Entry) {
  const text = `I dug ${entry.depth}m deep and hoarded ${entry.hoard} seeds in Squeek Deep, powered by a real hamster wheel on @Squeekchain #SqueekDeep ${location.href.split("#")[0]}`;
  return `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
