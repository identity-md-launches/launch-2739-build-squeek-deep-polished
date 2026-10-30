// Small, local personal_sign verifier. No RPC, keys, relay, or wallet dependency.
// Keccak-256 + secp256k1 public-key recovery, using native bigint arithmetic.
const MASK = (1n << 64n) - 1n;
const RC = [
  1n,
  0x8082n,
  0x800000000000808an,
  0x8000000080008000n,
  0x808bn,
  0x80000001n,
  0x8000000080008081n,
  0x8000000000008009n,
  0x8an,
  0x88n,
  0x80008009n,
  0x8000000an,
  0x8000808bn,
  0x800000000000008bn,
  0x8000000000008089n,
  0x8000000000008003n,
  0x8000000000008002n,
  0x8000000000000080n,
  0x800an,
  0x800000008000000an,
  0x8000000080008081n,
  0x8000000000008080n,
  0x80000001n,
  0x8000000080008008n,
];
const ROT = [
  0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18,
  2, 61, 56, 14,
];
const rol = (x: bigint, n: number) =>
  n ? ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK : x;
export function keccak(bytes: Uint8Array) {
  const rate = 136,
    data = new Uint8Array(Math.ceil((bytes.length + 1) / rate) * rate);
  data.set(bytes);
  data[bytes.length] = 1;
  data[data.length - 1] |= 128;
  const a = Array<bigint>(25).fill(0n);
  for (let off = 0; off < data.length; off += rate) {
    for (let i = 0; i < rate; i++)
      a[Math.floor(i / 8)] ^= BigInt(data[off + i]) << BigInt((i % 8) * 8);
    for (const rc of RC) {
      const col = Array.from(
        { length: 5 },
        (_, x) => a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20],
      );
      const d = col.map((_, x) => col[(x + 4) % 5] ^ rol(col[(x + 1) % 5], 1));
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) a[x + 5 * y] ^= d[x];
      const b = Array<bigint>(25).fill(0n);
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++)
          b[y + 5 * ((2 * x + 3 * y) % 5)] = rol(a[x + 5 * y], ROT[x + 5 * y]);
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++)
          a[x + 5 * y] =
            b[x + 5 * y] ^
            (~b[((x + 1) % 5) + 5 * y] & b[((x + 2) % 5) + 5 * y]);
      a[0] ^= rc;
    }
  }
  return Uint8Array.from({ length: 32 }, (_, i) =>
    Number((a[Math.floor(i / 8)] >> BigInt((i % 8) * 8)) & 255n),
  );
}
export const hex = (bytes: Uint8Array) =>
  "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
export const utf8Hex = (s: string) => hex(new TextEncoder().encode(s));
const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
type Point = { x: bigint; y: bigint } | null;
const G: Point = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};
const mod = (a: bigint, m = P) => ((a % m) + m) % m;
function pow(a: bigint, n: bigint, m = P) {
  let r = 1n;
  for (a = mod(a, m); n > 0n; n >>= 1n, a = (a * a) % m)
    if (n & 1n) r = (r * a) % m;
  return r;
}
function add(a: Point, b: Point): Point {
  if (!a) return b;
  if (!b) return a;
  if (a.x === b.x && mod(a.y + b.y) === 0n) return null;
  const k =
    a.x === b.x
      ? mod(3n * a.x * a.x * pow(2n * a.y, P - 2n))
      : mod((b.y - a.y) * pow(b.x - a.x, P - 2n));
  const x = mod(k * k - a.x - b.x);
  return { x, y: mod(k * (a.x - x) - a.y) };
}
function mul(p: Point, n: bigint): Point {
  let r: Point = null;
  for (n = mod(n, N); n > 0n; n >>= 1n, p = add(p, p))
    if (n & 1n) r = add(r, p);
  return r;
}
export function recoverAddress(message: string, signature: string) {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature))
    throw new Error("Wallet returned an unsupported signature.");
  const r = BigInt("0x" + signature.slice(2, 66)),
    s = BigInt("0x" + signature.slice(66, 130));
  let v = parseInt(signature.slice(130, 132), 16);
  if (v >= 27) v -= 27;
  if (r <= 0n || r >= N || s <= 0n || s >= N || v > 3)
    throw new Error("Wallet signature is invalid.");
  const x = r + BigInt(v >> 1) * N;
  if (x >= P) throw new Error("Wallet signature is invalid.");
  let y = pow(mod(x * x * x + 7n), (P + 1n) / 4n);
  if (Number(y & 1n) !== (v & 1)) y = P - y;
  if (mod(y * y) !== mod(x * x * x + 7n))
    throw new Error("Wallet signature is invalid.");
  const msg = new TextEncoder().encode(message),
    pre = new TextEncoder().encode(
      `\x19Ethereum Signed Message:\n${msg.length}`,
    );
  const data = new Uint8Array(pre.length + msg.length);
  data.set(pre);
  data.set(msg, pre.length);
  const h = BigInt(hex(keccak(data))),
    inverse = pow(r, N - 2n, N);
  const q = mul(add(mul({ x, y }, s), mul(G, -h)), inverse);
  if (!q) throw new Error("Wallet signature is invalid.");
  const pub = (
    q.x.toString(16).padStart(64, "0") + q.y.toString(16).padStart(64, "0")
  ).match(/../g)!;
  return hex(keccak(Uint8Array.from(pub, (b) => parseInt(b, 16))).slice(-20));
}
export interface Provider {
  request(args: { method: string; params?: unknown[] }): Promise<any>;
  on?: (event: string, callback: (...a: any[]) => void) => void;
  removeListener?: (event: string, callback: (...a: any[]) => void) => void;
}
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export interface WalletChoice {
  id: string;
  name: string;
  icon?: string;
  provider: Provider;
}
export function discoverWallets(update: (wallets: WalletChoice[]) => void) {
  const choices: WalletChoice[] = [];
  const announce = (event: Event) => {
    const d = (event as CustomEvent).detail;
    if (
      d?.provider?.request &&
      d.info?.uuid &&
      !choices.some((w) => w.id === d.info.uuid)
    ) {
      choices.push({
        id: d.info.uuid,
        name: String(d.info.name).slice(0, 50),
        icon: /^data:image\//.test(d.info.icon ?? "") ? d.info.icon : undefined,
        provider: d.provider,
      });
      update([...choices]);
    }
  };
  if (window.ethereum)
    update([
      { id: "browser", name: "Browser wallet", provider: window.ethereum },
    ]);
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", announce);
}
export async function signIn(provider: Provider) {
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const addr = accounts?.[0];
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr ?? ""))
    throw new Error("Select an Ethereum account in your wallet and retry.");
  const nonce = hex(crypto.getRandomValues(new Uint8Array(16))).slice(2);
  const message = `Squeek Deep sign-in\nAddress: ${addr}\nNonce: ${nonce}\nTime: ${new Date().toISOString()}`;
  const sig = await provider.request({
    method: "personal_sign",
    params: [utf8Hex(message), addr],
  });
  if (recoverAddress(message, sig).toLowerCase() !== addr.toLowerCase())
    throw new Error("The signature does not match the selected account.");
  return addr as string;
}
export async function recordRun(
  provider: Provider,
  addr: string,
  data: string,
) {
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: "0xaa36a7" }],
  });
  const chain = await provider.request({ method: "eth_chainId" });
  if (String(chain).toLowerCase() !== "0xaa36a7")
    throw new Error("Switch your wallet to Sepolia and retry.");
  const accounts = await provider.request({ method: "eth_accounts" });
  if (!accounts?.some((a: string) => a.toLowerCase() === addr.toLowerCase()))
    throw new Error("Reconnect the account you signed in with.");
  const tx = await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: addr,
        to: addr,
        value: "0x0",
        data: utf8Hex(data),
        chainId: "0xaa36a7",
      },
    ],
  });
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx ?? ""))
    throw new Error("The wallet did not return a transaction hash.");
  return tx as string;
}
export function walletError(e: unknown) {
  const error = e as { code?: number; message?: string };
  return error.code === 4001
    ? "Request declined. You can keep playing without a wallet."
    : error.code === 4902
      ? "Add the Sepolia test network in your wallet, then retry."
      : error.message ||
        "Wallet unavailable. You can keep playing and retry later.";
}
