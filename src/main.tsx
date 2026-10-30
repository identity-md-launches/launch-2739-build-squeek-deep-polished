import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { A, audio, loadImages } from "./assets";
import { Game, HEIGHT, WIDTH, type Snapshot } from "./engine";
import {
  BASE,
  ITEMS,
  LAYERS,
  UPGRADES,
  fmt,
  rank,
  readLeaderboard,
  readSave,
  shortAddress,
  store,
  utcDate,
  type Entry,
  type Mode,
  type Save,
} from "./model";
import { WheelService, initialWheel } from "./wheel";
import {
  discoverWallets,
  recordRun,
  signIn,
  walletError,
  type Provider,
  type WalletChoice,
} from "./wallet";
import { copyCard, downloadCard, makeShareCard, tweetURL } from "./share";
import "./style.css";

type Modal =
  | "help"
  | "credits"
  | "leaderboard"
  | "shop"
  | "pause"
  | "wallet"
  | "share"
  | null;
function Item({ item, size = 32 }: { item: number; size?: number }) {
  return (
    <span
      className="item-icon"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundSize: `${16 * size}px ${size}px`,
        backgroundPosition: `${-item * size}px 0`,
      }}
    />
  );
}
function Button({
  variant = "wood",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "green" | "wood";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`pixel-button ${variant} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
function Dialog({
  title,
  close,
  children,
  wide = false,
  className = "",
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "wide" : ""} ${className}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-inner">
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button
            type="button"
            className="close-button"
            aria-label={`Close ${title}`}
            onClick={close}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function gameKey(
  e: Pick<KeyboardEvent, "code" | "key" | "isComposing" | "keyCode">,
) {
  // Arrows remain usable inside an IME; composition must not turn letter keys into actions.
  if (e.code.startsWith("Arrow")) return e.code.toLowerCase();
  if (e.isComposing || e.keyCode === 229) return null;
  if (/^Key[WASDQEFP]$/.test(e.code)) return e.code.slice(3).toLowerCase();
  if (e.code === "Space") return " ";
  if (e.code === "Escape") return "escape";
  return e.key.toLowerCase();
}
function App() {
  const [save, setSave] = useState<Save>(readSave);
  const saveRef = useRef(save);
  saveRef.current = save;
  const [entries, setEntries] = useState<Entry[]>(readLeaderboard);
  const [screen, setScreen] = useState<"title" | "game" | "results">("title");
  const [modal, setModal] = useState<Modal>(null);
  const [mode, setMode] = useState<Mode>("normal");
  const [tab, setTab] = useState<Mode>("normal");
  const [wheel, setWheel] = useState(initialWheel);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<Entry | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [notice, setNotice] = useState("");
  const [wallets, setWallets] = useState<WalletChoice[]>([]);
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const provider = useRef<Provider>();
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [shareURL, setShareURL] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Game>();
  const service = useRef<WheelService>();
  const [scale, setScale] = useState(1);
  const [coarse, setCoarse] = useState(false);
  const [showHint, setShowHint] = useState(!save.hintSeen);

  useEffect(() => {
    if (!store("squeekdeep.v1.save", save)) setStorageError(true);
    audio.muted = save.settings.muted;
    audio.musicVolume = save.settings.music;
    audio.sfxVolume = save.settings.sfx;
    audio.sync();
    if (engine.current) {
      engine.current.screenShake = save.settings.screenShake;
      engine.current.reducedMotion =
        save.settings.reducedMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }, [save]);
  useEffect(() => {
    if (!store("squeekdeep.v1.lb", entries)) setStorageError(true);
  }, [entries]);
  useEffect(() => discoverWallets(setWallets), []);
  useEffect(() => {
    if (!provider.current?.on) return;
    const p = provider.current;
    const disconnect = () => {
      setAddress("");
      provider.current = undefined;
      setWalletNote("Wallet account changed. Connect again to sign in.");
    };
    p.on?.("accountsChanged", disconnect);
    p.on?.("disconnect", disconnect);
    return () => {
      p.removeListener?.("accountsChanged", disconnect);
      p.removeListener?.("disconnect", disconnect);
    };
  }, [address]);
  useEffect(() => {
    let cancelled = false,
      frame = 0,
      last = 0,
      uiTime = 0;
    const wheelService = new WheelService((w, quake) => {
      if (cancelled) return;
      setWheel({ ...w });
      engine.current?.setWheel(w, quake);
      const game = engine.current;
      if (game?.started && game.paused && !game.ended) game.draw();
    });
    service.current = wheelService;
    wheelService.start(false);
    const unlock = () => audio.unlock();
    addEventListener("pointerdown", unlock, { once: true });
    addEventListener("keydown", unlock, { once: true });
    void loadImages()
      .then(async (images) => {
        await document.fonts.load('16px "Pixelify Sans"');
        if (cancelled) return;
        const game = new Game(
          canvas.current!,
          images,
          (data) => {
            const s = saveRef.current;
            const entry: Entry = {
              ...data,
              name:
                s.name ||
                (provider.current && address ? shortAddress(address) : "Pip"),
              addr: provider.current
                ? (engine.current as Game & { playerAddress?: string })
                    .playerAddress
                : undefined,
            };
            setResult(entry);
            setEntries((old) => rank([...old, entry]));
            setSave((old) => ({ ...old, lastDepth: entry.depth }));
            setScreen("results");
            setModal(null);
          },
          (value, m) => {
            setSave((old) =>
              m === "practice"
                ? { ...old, practiceHoard: old.practiceHoard + value }
                : { ...old, hoard: old.hoard + value },
            );
          },
        );
        engine.current = game;
        game.wheel = wheelService.state;
        game.screenShake = saveRef.current.settings.screenShake;
        game.reducedMotion =
          saveRef.current.settings.reducedMotion ||
          matchMedia("(prefers-reduced-motion: reduce)").matches;
        setReady(true);
        const loop = (now: number) => {
          if (cancelled) return;
          const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
          last = now;
          if (game.started && !game.paused && !game.ended) {
            game.update(dt);
            game.draw();
            if (now - uiTime > 100) {
              setSnapshot(game.snapshot());
              uiTime = now;
            }
          }
          frame = requestAnimationFrame(loop);
        };
        frame = requestAnimationFrame(loop);
      })
      .catch((e) => setLoadError(e.message));
    const query = matchMedia("(pointer: coarse), (max-width: 650px)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => {
      if (engine.current)
        engine.current.reducedMotion =
          saveRef.current.settings.reducedMotion || motion.matches;
    };
    motion.addEventListener("change", syncMotion);
    const touch = () => setCoarse(query.matches);
    touch();
    query.addEventListener("change", touch);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      wheelService.stop();
      query.removeEventListener("change", touch);
      motion.removeEventListener("change", syncMotion);
      removeEventListener("pointerdown", unlock);
      removeEventListener("keydown", unlock);
    };
  }, []);
  useEffect(() => {
    const resize = () => {
      if (!stage.current) return;
      const available = stage.current.clientWidth;
      const s =
        available < WIDTH
          ? available / WIDTH
          : Math.min(3, Math.floor(available / WIDTH));
      setScale(s);
      if (engine.current) {
        engine.current.visibleWidth = WIDTH;
        engine.current.screenScale = s;
      }
    };
    const r = new ResizeObserver(resize);
    if (stage.current) r.observe(stage.current);
    resize();
    return () => r.disconnect();
  }, [ready, screen]);
  useEffect(() => {
    window.scrollTo(0, 0);
    document.body.classList.toggle("playing", screen === "game");
  }, [screen]);
  useEffect(() => {
    if (snapshot?.hasDug && showHint) {
      setShowHint(false);
      setSave((old) => ({ ...old, hintSeen: true }));
    }
  }, [snapshot?.hasDug, showHint]);
  useEffect(() => {
    if (engine.current) {
      engine.current.paused = screen !== "game" || modal !== null;
      if (modal) engine.current.clearInput();
    }
  }, [screen, modal]);
  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        modal
      )
        return;
      if (
        e.target instanceof HTMLButtonElement &&
        [" ", "Enter"].includes(e.key)
      )
        return;
      const key = gameKey(e);
      if (!key) return;
      if (screen === "game") {
        if (["escape", "p"].includes(key)) {
          e.preventDefault();
          setModal("pause");
          return;
        }
        if (
          [
            " ",
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            "w",
            "a",
            "s",
            "d",
            "e",
            "q",
            "f",
          ].includes(key)
        ) {
          e.preventDefault();
          engine.current?.press(key);
        }
      }
    };
    const keyup = (e: KeyboardEvent) =>
      engine.current?.release(
        gameKey(e) || e.code.replace("Key", "").toLowerCase(),
      );
    const loseFocus = () => {
      engine.current?.clearInput();
      if (screen === "game" && !modal) setModal("pause");
    };
    const visibility = () => {
      if (document.hidden) loseFocus();
    };
    addEventListener("keydown", keydown);
    addEventListener("keyup", keyup);
    addEventListener("blur", loseFocus);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      removeEventListener("keydown", keydown);
      removeEventListener("keyup", keyup);
      removeEventListener("blur", loseFocus);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [screen, modal]);
  useEffect(() => {
    if (!shareBlob) {
      setShareURL("");
      return;
    }
    const url = URL.createObjectURL(shareBlob);
    setShareURL(url);
    return () => URL.revokeObjectURL(url);
  }, [shareBlob]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch(() => {
        /* File previews may not permit a service worker. */
      });
  }, []);

  const closeModal = () => {
    audio.play("click", 0.25);
    setModal(null);
  };
  const open = (m: Modal) => {
    setNotice("");
    audio.play("click", 0.25);
    setModal(m);
  };
  const start = (m: Mode) => {
    if (!engine.current) return;
    audio.unlock();
    audio.play("click");
    engine.current.campHoard =
      m === "practice" ? save.practiceHoard : save.hoard;
    setShowHint(!save.hintSeen);
    setMode(m);
    setTab(m);
    setResult(null);
    setShareBlob(null);
    setNotice("");
    engine.current.start(
      m,
      m === "practice" ? save.practiceUpgrades : save.upgrades,
    );
    (engine.current as Game & { playerAddress?: string }).playerAddress =
      address || undefined;
    service.current!.start(m === "practice");
    setSnapshot(engine.current.snapshot());
    setModal(null);
    setScreen("game");
  };
  const goTitle = () => {
    engine.current?.clearInput();
    if (engine.current) engine.current.paused = true;
    setModal(null);
    setScreen("title");
    service.current?.start(false);
  };
  const balance = mode === "practice" ? save.practiceHoard : save.hoard;
  const levels =
    mode === "daily"
      ? BASE
      : mode === "practice"
        ? save.practiceUpgrades
        : save.upgrades;
  const buy = (id: (typeof UPGRADES)[number]["id"]) => {
    if (mode === "daily") {
      setNotice(
        "Daily runs use base stats. Upgrades are available in Adventure and Practice.",
      );
      return;
    }
    const info = UPGRADES.find((u) => u.id === id)!,
      level = levels[id],
      cost = info.costs[level];
    if (!snapshot?.atCamp || cost === undefined || balance < cost) return;
    const next = { ...levels, [id]: level + 1 };
    setSave((old) =>
      mode === "practice"
        ? {
            ...old,
            practiceHoard: old.practiceHoard - cost,
            practiceUpgrades: next,
          }
        : { ...old, hoard: old.hoard - cost, upgrades: next },
    );
    engine.current?.buyLevels(next);
    if (engine.current) engine.current.campHoard = balance - cost;
    audio.play("upgrade");
    setNotice(`${info.name} upgraded to level ${level + 1}.`);
  };
  const connect = async (w: WalletChoice) => {
    setPending(w.id);
    setWalletNote("Check your wallet for the sign-in request.");
    try {
      const addr = await signIn(w.provider);
      provider.current = w.provider;
      setAddress(addr);
      if (engine.current)
        (engine.current as Game & { playerAddress?: string }).playerAddress =
          addr;
      setSave((old) => ({ ...old, name: shortAddress(addr) }));
      setWalletNote("Signed in. Your wallet stays optional.");
      setModal(null);
    } catch (e) {
      setWalletNote(walletError(e));
    } finally {
      setPending("");
    }
  };
  const record = async () => {
    if (!address || !provider.current) {
      open("wallet");
      return;
    }
    if (!result) return;
    setPending("record");
    setWalletNote(
      "Approve the Sepolia network switch, then the 0 ETH self-transaction.",
    );
    try {
      const txHash = await recordRun(
        provider.current,
        address,
        `SQDEEP|v1|${result.score}|${result.depth}|${result.date}|${result.seedHash}`,
      );
      const next = { ...result, addr: address, txHash };
      setResult(next);
      setEntries((old) =>
        rank(old.map((e) => (e.id === result.id ? next : e))),
      );
      setWalletNote(
        "Transaction submitted. Open Etherscan to check confirmation.",
      );
    } catch (e) {
      setWalletNote(walletError(e));
    } finally {
      setPending("");
    }
  };
  const share = async () => {
    if (!result) return;
    setNotice("Drawing your share card…");
    open("share");
    try {
      setShareBlob(await makeShareCard(result));
      setNotice("");
    } catch (e) {
      setNotice((e as Error).message);
    }
  };
  const touchButton = (
    key: string,
    label: string,
    text: string,
    className = "",
  ) => (
    <button
      type="button"
      className={`touch-button ${className}`}
      aria-label={text === "A" || text === "B" ? `${text}: ${label}` : label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        audio.unlock();
        engine.current?.press(key);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        engine.current?.release(key);
      }}
      onPointerCancel={() => engine.current?.release(key)}
      onLostPointerCapture={() => engine.current?.release(key)}
    >
      {text}
    </button>
  );
  const wheelLabel = wheel.practice
    ? "Practice wheel"
    : wheel.lost
      ? "Wheel signal lost"
      : !wheel.updated
        ? "Finding the wheel…"
        : wheel.active
          ? "Wheel is running"
          : "Wheel is resting";

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to game
      </a>
      <header className="site-header">
        <button
          type="button"
          className="brand"
          onClick={() => (screen === "game" ? open("pause") : goTitle())}
          aria-label="Squeek Deep home"
        >
          <span className="brand-pip" aria-hidden="true" />
          <span>
            Squeek<span className="brand-deep"> Deep</span>
          </span>
        </button>
        <div className="header-actions">
          <button
            type="button"
            className="utility help-utility"
            onClick={() => open("help")}
          >
            How to play
          </button>
          <button
            type="button"
            className="utility sound-button"
            aria-label={
              save.settings.muted
                ? "Sound off: turn sound on"
                : "Sound on: mute sound"
            }
            aria-pressed={!save.settings.muted}
            onClick={() => {
              audio.unlock();
              setSave((s) => ({
                ...s,
                settings: { ...s.settings, muted: !s.settings.muted },
              }));
            }}
          >
            <span aria-hidden="true">{save.settings.muted ? "♪̸" : "♫"}</span>
            <span className="sound-word">
              {save.settings.muted ? "Sound off" : "Sound on"}
            </span>
          </button>
        </div>
      </header>
      <main id="main">
        {screen === "title" && (
          <>
            <section className="title-scene" aria-labelledby="title-heading">
              <img
                className="title-art"
                src={`${A}keyart/title_keyart.webp`}
                alt="Pip the hamster, cheeks full of gems, riding a basket into a glowing pixel-art mine"
                fetchPriority="high"
              />
              <div className="title-content">
                <h1 id="title-heading">
                  Tiny paws.
                  <br />
                  <span>Deep pockets.</span>
                </h1>
                <p className="title-description">
                  A hamster mining roguelite powered by a real wheel.
                </p>
                <div className="title-actions">
                  <Button
                    variant="gold"
                    className="play-button"
                    disabled={!ready && !loadError}
                    aria-label={loadError ? "Reload mine" : "Play adventure"}
                    onClick={() =>
                      loadError ? location.reload() : start("normal")
                    }
                  >
                    <Item item={0} />
                    {loadError ? "Reload mine" : ready ? "Play" : "Loading…"}
                    <span aria-hidden="true">→</span>
                  </Button>
                  <div className="mode-actions">
                    <Button onClick={() => start("daily")} disabled={!ready}>
                      <Item item={9} size={24} />
                      Daily mine
                    </Button>
                    <Button onClick={() => start("practice")} disabled={!ready}>
                      <Item item={14} size={24} />
                      Practice
                    </Button>
                  </div>
                </div>
                {loadError && <p role="alert">{loadError}</p>}
                <nav className="title-links" aria-label="Game menu">
                  <button type="button" onClick={() => open("leaderboard")}>
                    Leaderboard
                  </button>
                  <button type="button" onClick={() => open("help")}>
                    How to play
                  </button>
                  <button type="button" onClick={() => open("credits")}>
                    Credits
                  </button>
                </nav>
              </div>
              <div className="art-caption">
                <span className={`status-dot ${wheel.active ? "on" : ""}`} />
                Powered by a real hamster wheel
              </div>
            </section>
            <div className="title-bottom">
              <div className="wheel-status">
                <span className={`status-dot ${wheel.active ? "on" : ""}`} />
                <span>{wheelLabel}</span>
                {wheel.updated && !wheel.lost && (
                  <span className="muted">{Math.round(wheel.rpm)} rpm</span>
                )}
              </div>
              <span className="title-note">
                6 layers. 300 metres. One very hungry hamster.
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => open("wallet")}
              >
                {address ? shortAddress(address) : "Connect wallet"}
                <span className="muted"> · optional</span>
              </button>
            </div>
            <div className="title-facts" aria-label="Game features">
              <span>
                <Item item={7} size={24} />
                Dig. Stuff. Hoard.
              </span>
              <span>
                <Item item={13} size={24} />
                Single player
              </span>
              <span>
                <Item item={14} size={24} />
                Practice works offline
              </span>
            </div>
          </>
        )}

        <section
          className="game-screen"
          hidden={screen !== "game"}
          aria-label="The mine"
        >
          <div className="mine-heading">
            <div>
              <h1>
                {mode === "daily"
                  ? "The daily mine"
                  : mode === "practice"
                    ? "The practice mine"
                    : "Pip’s little adventure"}
              </h1>
              <span className="muted">
                {mode === "daily"
                  ? `${utcDate()} · shared seed · base stats`
                  : mode === "practice"
                    ? "Offline · simulated wheel · unranked"
                    : "Bring something lovely home."}
              </span>
            </div>
            <Button className="pause-button" onClick={() => open("pause")}>
              Pause <kbd>P</kbd>
            </Button>
          </div>
          <div
            className="game-frame"
            ref={stage}
            style={{ height: HEIGHT * scale }}
          >
            <canvas
              ref={canvas}
              width={WIDTH}
              height={HEIGHT}
              style={{ width: WIDTH * scale, height: HEIGHT * scale }}
              aria-label="Squeek Deep mine. Use arrows or WASD to move and dig, Space to jump, Q for basket, E to spit, P to pause."
              role="img"
            />
            {showHint && (
              <div className="first-dig-hint" role="note">
                <span className="hint-pip" aria-hidden="true" />
                <p>
                  {coarse
                    ? "Hold ← / → / ↓ to dig. Tap Jump to hop, Call basket to return, Spit to lighten your cheeks."
                    : "Hold Left/Right/Down (or A/D/S) to dig, Space/Up to jump, Q call basket, E spit"}
                </p>
              </div>
            )}
            {snapshot?.settling && (
              <div className="settling-banner" role="status">
                Rumble... round settling
              </div>
            )}
          </div>
          {coarse && (
            <div className="touch-top" aria-label="Mine actions">
              <Button onClick={() => open("pause")}>Pause</Button>
              <Button onClick={() => engine.current?.callBasket()}>
                {snapshot?.riding ? "Step off basket" : "Call basket ↑"}
              </Button>
            </div>
          )}
          {coarse && (
            <div className="touch-controls" aria-label="Touch game controls">
              <div className="dpad">
                {touchButton("arrowup", "Jump up", "↑", "up")}
                {touchButton("arrowleft", "Move and dig left", "←", "left")}
                {touchButton("arrowdown", "Dig down", "↓", "down")}
                {touchButton("arrowright", "Move and dig right", "→", "right")}
              </div>
              <div className="touch-ab">
                {touchButton("e", "Spit cheek contents", "Spit", "spit")}
                {touchButton(" ", "Jump", "Jump", "jump")}
              </div>
            </div>
          )}
          <div className="mine-message" role="status">
            {snapshot?.message ||
              (snapshot?.atCamp
                ? "Home sweet hoard. Dig down when you’re ready."
                : "Hold into soil to dig. Q calls the basket. E lightens your cheeks.")}
          </div>
          {snapshot?.atCamp ? (
            <section className="camp-panel" aria-label="Surface actions">
              <div className="camp-actions">
                <Button
                  variant="gold"
                  onClick={() => engine.current?.deposit()}
                  disabled={!snapshot.load}
                >
                  Deposit haul <kbd>F</kbd>
                </Button>
                <Button onClick={() => open("shop")}>Visit shop</Button>
                <Button
                  onClick={() => {
                    engine.current?.finish(true);
                  }}
                >
                  Retire safely
                </Button>
              </div>
            </section>
          ) : (
            <div className="underground-actions">
              <Button onClick={() => engine.current?.callBasket()}>
                {snapshot?.riding ? "Step off basket" : "Call basket"}{" "}
                <kbd>Q</kbd>
              </Button>
              <Button onClick={() => engine.current?.spit()}>
                Spit treasure <kbd>E</kbd>
              </Button>
              <span
                className={`wheel-status ${wheel.active ? "active-text" : ""}`}
              >
                {wheelLabel}
                {wheel.active ? ` · ${Math.round(wheel.rpm)} rpm` : ""}
              </span>
            </div>
          )}
          <details className="run-details" open={!coarse}>
            <summary>
              {snapshot?.atCamp ? "Camp & run details" : "Run details"} ·{" "}
              {snapshot?.depth ?? 0}m · {fmt(snapshot?.hoard ?? 0)} hoarded
            </summary>
            <div className="run-stats" aria-label="Run statistics">
              <div>
                <span className="muted">Depth</span>
                <strong>
                  {snapshot?.depth ?? 0}
                  <small> m</small>
                </strong>
                <span>{snapshot?.layer || "Topsoil"}</span>
              </div>
              <div>
                <span className="muted">In your cheeks</span>
                <strong>
                  {snapshot?.load ?? 0}
                  <small> / {snapshot?.capacity ?? 10}</small>
                </strong>
                <span>{fmt(snapshot?.value ?? 0)} seeds of treasure</span>
              </div>
              <div>
                <span className="muted">Safely hoarded</span>
                <strong className="gold-text">
                  {fmt(snapshot?.hoard ?? 0)}
                </strong>
                <span>Best depth {snapshot?.maxDepth ?? 0}m</span>
              </div>
              <div className="run-health">
                <span className="muted">Little hamster, big heart</span>
                <div
                  role="img"
                  aria-label={`${snapshot?.hp ?? 3} of ${snapshot?.maxHP ?? 3} health`}
                  className="hearts"
                >
                  {Array.from({ length: snapshot?.maxHP ?? 3 }, (_, i) => (
                    <span
                      key={i}
                      style={{ opacity: i < (snapshot?.hp ?? 3) ? 1 : 0.25 }}
                    >
                      <Item item={13} size={28} />
                    </span>
                  ))}
                </div>
                <span>
                  {snapshot?.riding
                    ? "Riding home"
                    : `${Math.ceil(snapshot?.battery ?? 0)}s battery charge`}
                </span>
              </div>
            </div>
            {snapshot?.atCamp && (
              <div className="camp-details">
                <div className="camp-greeting">
                  <Item item={15} size={48} />
                  <div>
                    <h2 id="camp-heading">Home sweet hoard.</h2>
                    <p>
                      {save.lastDepth
                        ? `Back again! Last time you reached ${save.lastDepth}m.`
                        : "Every great hoard begins with a tiny seed."}
                    </p>
                  </div>
                </div>
                <div className="camp-board">
                  <span>
                    Squeek minted <strong>{wheel.minted}</strong>
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open("leaderboard")}
                  >
                    Local leaderboard →
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => open("wallet")}
                  >
                    {address
                      ? shortAddress(address)
                      : "Connect wallet · optional"}
                  </button>
                </div>
                <label className="name-field">
                  Miner name
                  <input
                    name="miner-name"
                    autoComplete="nickname"
                    maxLength={20}
                    value={save.name}
                    onChange={(e) =>
                      setSave((s) => ({ ...s, name: e.target.value }))
                    }
                  />
                </label>
              </div>
            )}
          </details>
          <div className="keyboard-hint">
            <span>
              <kbd>←</kbd>
              <kbd>↓</kbd>
              <kbd>→</kbd> move & dig
            </span>
            <span>
              <kbd>Space</kbd> jump
            </span>
            <span>
              <kbd>Q</kbd> basket
            </span>
            <span>
              <kbd>E</kbd> spit
            </span>
            <span>
              <kbd>P</kbd> pause
            </span>
          </div>
        </section>

        {screen === "results" && result && (
          <section className="results-screen" aria-labelledby="results-heading">
            <div className="results-art" aria-hidden="true">
              <img src={`${A}keyart/title_keyart.webp`} alt="" />
            </div>
            <div className="results-intro">
              <div
                className={`results-pip${engine.current?.hp === 0 ? " hurt" : ""}`}
                aria-hidden="true"
              />
              <h1 id="results-heading">
                {engine.current?.hp === 0
                  ? "Paws up, little miner."
                  : "Home with a hoard."}
              </h1>
              <p>
                {engine.current?.hp === 0
                  ? "Your cheek treasure was lost. Everything you deposited is safe."
                  : "Paws up, Pip. Your treasure is safely tucked away."}
              </p>
              <span className="muted">
                {result.mode === "daily"
                  ? "Daily mine"
                  : result.mode === "practice"
                    ? "Practice · unranked"
                    : "Adventure"}{" "}
                · {result.date}
              </span>
            </div>
            <div className="result-score">
              <span>Run score</span>
              <strong>{fmt(result.score)}</strong>
              <span className="muted">Hoard + deepest metre × 5</span>
            </div>
            <div className="result-grid">
              <div>
                <Item item={9} size={40} />
                <strong>{result.depth}m</strong>
                <span>Deepest burrow</span>
              </div>
              <div>
                <Item item={0} size={40} />
                <strong>{fmt(result.hoard)}</strong>
                <span>Seeds hoarded</span>
              </div>
              <div>
                <Item item={15} size={40} />
                <strong>{fmt(result.best)}</strong>
                <span>Best single haul</span>
              </div>
            </div>
            <div className="results-actions">
              <Button variant="gold" onClick={share}>
                Share your haul
              </Button>
              <Button onClick={() => start(mode)}>Dig again</Button>
              <Button onClick={goTitle}>Back to title</Button>
            </div>
            <section className="record-panel">
              <h2>A tiny mark on the chain.</h2>
              <p>
                Optional Sepolia testnet record: send 0 ETH to yourself with
                your run in the transaction data. Testnet gas applies.
              </p>
              {result.mode === "practice" ? (
                <p className="muted">Practice runs stay local and unranked.</p>
              ) : result.txHash ? (
                <a
                  className="transaction-link"
                  href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on Sepolia Etherscan ↗
                  <span>{result.txHash}</span>
                </a>
              ) : (
                <Button
                  disabled={pending === "record"}
                  onClick={() => void record()}
                >
                  {pending === "record"
                    ? "Waiting for wallet…"
                    : "Record run on Sepolia"}
                </Button>
              )}
              <p role="status" className="wallet-note">
                {walletNote}
              </p>
            </section>
            <button
              type="button"
              className="text-button"
              onClick={() => open("leaderboard")}
            >
              See the local leaderboard →
            </button>
          </section>
        )}
        {storageError && (
          <p className="storage-note" role="status">
            Browser storage is unavailable. You can play, but progress will not
            survive a reload.
          </p>
        )}
      </main>
      <footer className="site-footer">
        <span>
          Squeek Deep{" "}
          <span className="muted">· a little deeper, a little richer.</span>
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => open("credits")}
        >
          Art, audio & credits
        </button>
      </footer>

      {modal && (
        <Dialog
          title={
            {
              help: "A tiny guide to the deep",
              credits: "Made for little adventures",
              leaderboard: "The hoard board",
              shop: "A little help for little paws",
              pause: "Take a breather.",
              wallet: "Connect a wallet",
              share: "One very shareable hamster.",
            }[modal]
          }
          close={closeModal}
          wide={["help", "shop", "leaderboard", "share"].includes(modal)}
          className={modal === "shop" ? "shop-dialog" : ""}
        >
          {modal === "help" && (
            <>
              <p>
                Meet Pip. Dig up seeds and gems, fill your cheeks, then bring
                them back to the surface chest. A real hamster wheel powers the
                ride home.
              </p>
              <div className="help-loop">
                <span>
                  <Item item={10} size={40} />
                  Dig down
                </span>
                <span>
                  <Item item={7} size={40} />
                  Stuff cheeks
                </span>
                <span>
                  <Item item={15} size={40} />
                  Hoard & upgrade
                </span>
              </div>
              <dl className="controls-list">
                <div>
                  <dt>Move & dig</dt>
                  <dd>
                    <kbd>← ↓ →</kbd> or <kbd>A S D</kbd>. Hold into soil.
                  </dd>
                </div>
                <div>
                  <dt>Jump</dt>
                  <dd>
                    <kbd>Space</kbd>, <kbd>W</kbd> or <kbd>↑</kbd>. Hold to jump
                    higher.
                  </dd>
                </div>
                <div>
                  <dt>Call basket</dt>
                  <dd>
                    <kbd>Q</kbd>. Always returns you home. The wheel or a
                    battery makes it faster.
                  </dd>
                </div>
                <div>
                  <dt>Spit</dt>
                  <dd>
                    <kbd>E</kbd>. Drops your load for a 2-second speed burst.
                  </dd>
                </div>
                <div>
                  <dt>Pause</dt>
                  <dd>
                    <kbd>P</kbd> or <kbd>Esc</kbd>. The mine pauses while menus
                    are open.
                  </dd>
                </div>
                <div>
                  <dt>Deposit</dt>
                  <dd>
                    Walk to the chest or press <kbd>F</kbd> at the surface.
                  </dd>
                </div>
              </dl>
              <p>
                Full cheeks slow you down. Damage spills 30% of your load. Stomp
                beetles and bats, swing at critters, and give magma slugs a wide
                berth.
              </p>
              <p>
                Earthquakes reshape the mine when a real round settles. Daily
                starts everyone on the same UTC-date map with base stats.
                Practice uses a simulated wheel, quakes every 90 seconds, and
                keeps its own hoard.
              </p>
              <div className="layer-list">
                {LAYERS.map((l, i) => (
                  <div key={l.name}>
                    <span
                      className="layer-swatch"
                      style={{
                        backgroundImage: `url(${A}tiles/tiles.png)`,
                        backgroundPosition: `0 ${-i * 32}px`,
                      }}
                    />
                    <span>{l.name}</span>
                    <span className="muted">
                      {l.from}–{l.to}m
                    </span>
                  </div>
                ))}
              </div>
              <Button variant="gold" onClick={closeModal}>
                Got it. Let’s dig.
              </Button>
            </>
          )}
          {modal === "credits" && (
            <>
              <div className="credits-pip" aria-hidden="true" />
              <p>
                Art & audio: original for Squeek Deep.
                <br />
                Font: Pixelify Sans (OFL).
              </p>
              <p>
                The mine is powered by the real wheel at Squeekchain. Adventure
                and Daily read the public wheel API. Practice is fully
                simulated.
              </p>
              <p>
                Scores and upgrades live in this browser. Wallet sign-in and a
                Sepolia run record are optional.
              </p>
              <a href="./FONT-LICENSE.txt" target="_blank" rel="noreferrer">
                Read the font license
              </a>
              <Button onClick={closeModal}>Back to Pip</Button>
            </>
          )}
          {modal === "leaderboard" && (
            <>
              <p className="muted">
                Your top 20 runs per mode, saved in this browser. No global or
                shared ranking.
              </p>
              <div
                className="tabs"
                role="tablist"
                aria-label="Leaderboard mode"
              >
                {(["normal", "daily", "practice"] as Mode[]).map(
                  (m, i, all) => (
                    <button
                      type="button"
                      key={m}
                      role="tab"
                      aria-selected={tab === m}
                      tabIndex={tab === m ? 0 : -1}
                      onClick={() => setTab(m)}
                      onKeyDown={(e) => {
                        if (
                          ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                            e.key,
                          )
                        ) {
                          e.preventDefault();
                          const next =
                            e.key === "Home"
                              ? 0
                              : e.key === "End"
                                ? 2
                                : (i + (e.key === "ArrowRight" ? 1 : 2)) % 3;
                          setTab(all[next]);
                          (
                            e.currentTarget.parentElement?.children[
                              next
                            ] as HTMLButtonElement
                          ).focus();
                        }
                      }}
                    >
                      {m === "normal"
                        ? "All-time"
                        : m === "daily"
                          ? "Daily"
                          : "Practice"}
                    </button>
                  ),
                )}
              </div>
              <div role="tabpanel" aria-label={`${tab} leaderboard`}>
                {entries.filter((e) => e.mode === tab).length ? (
                  <div className="leaderboard-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Miner</th>
                          <th>Depth</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries
                          .filter((e) => e.mode === tab)
                          .sort((a, b) => b.score - a.score)
                          .map((e, i) => (
                            <tr key={e.id}>
                              <td>
                                <span className="rank">{i + 1}.</span> {e.name}
                                <small>
                                  {e.date}
                                  {e.txHash && (
                                    <>
                                      {" "}
                                      ·{" "}
                                      <a
                                        aria-label={`Sepolia record for ${e.name}`}
                                        href={`https://sepolia.etherscan.io/tx/${e.txHash}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        On chain ↗
                                      </a>
                                    </>
                                  )}
                                </small>
                              </td>
                              <td>{e.depth}m</td>
                              <td className="gold-text">{fmt(e.score)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-board">
                    <Item item={15} size={64} />
                    <h3>A hoard waiting to happen.</h3>
                    <p>
                      Finish{" "}
                      {tab === "practice"
                        ? "a practice"
                        : tab === "daily"
                          ? "a daily"
                          : "an adventure"}{" "}
                      run to leave your first score.
                    </p>
                    <Button
                      variant="gold"
                      onClick={() =>
                        screen === "game" ? closeModal() : start(tab)
                      }
                    >
                      {screen === "game" ? "Keep digging" : "Start digging"}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
          {modal === "shop" && (
            <>
              <p>Spend deposited seeds on your next little advantage.</p>
              <div className="shop-balance">
                <Item item={0} />
                <strong>{fmt(balance)} seeds</strong>
                <span className="muted">
                  {mode === "daily"
                    ? "Daily · base stats only"
                    : mode === "practice"
                      ? "Practice hoard"
                      : "Adventure hoard"}
                </span>
              </div>
              {mode === "daily" && (
                <p className="inline-note">
                  Daily runs always use base stats. Visit the shop in Adventure
                  or Practice to upgrade.
                </p>
              )}
              <div className="upgrade-list">
                {UPGRADES.map((u) => {
                  const level = levels[u.id],
                    price = u.costs[level];
                  return (
                    <div className="upgrade-row" key={u.id}>
                      <span className="icon-slot">
                        <Item item={u.icon} size={40} />
                      </span>
                      <div>
                        <h3>
                          {u.name}
                          <span className="muted">
                            {" "}
                            {level}/{u.costs.length}
                          </span>
                        </h3>
                        <p>{u.detail}</p>
                      </div>
                      <Button
                        variant={
                          price <= balance && mode !== "daily" ? "gold" : "wood"
                        }
                        aria-label={
                          price === undefined
                            ? `${u.name} maximum level`
                            : `Upgrade ${u.name} for ${price} seeds`
                        }
                        disabled={
                          price === undefined ||
                          balance < price ||
                          mode === "daily"
                        }
                        onClick={() => buy(u.id)}
                      >
                        {price === undefined ? "Maxed" : fmt(price)}
                        {price !== undefined && <Item item={0} size={20} />}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <p role="status">{notice}</p>
              <Button onClick={closeModal}>Back to camp</Button>
            </>
          )}
          {modal === "pause" && (
            <>
              <p>Even the smallest paws need a moment. The mine is paused.</p>
              <div className="pause-actions">
                <Button variant="gold" onClick={closeModal}>
                  Keep digging
                </Button>
                <Button onClick={() => open("help")}>How to play</Button>
                {snapshot?.atCamp && (
                  <Button onClick={() => open("shop")}>Visit shop</Button>
                )}
              </div>
              <div className="settings">
                <label>
                  Music volume
                  <input
                    aria-label="Music volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={save.settings.music}
                    onChange={(e) =>
                      setSave((s) => ({
                        ...s,
                        settings: { ...s.settings, music: +e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Effects volume
                  <input
                    aria-label="Effects volume"
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={save.settings.sfx}
                    onChange={(e) =>
                      setSave((s) => ({
                        ...s,
                        settings: { ...s.settings, sfx: +e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Screen shake
                  <select
                    aria-label="Screen shake"
                    value={save.settings.screenShake}
                    onChange={(e) =>
                      setSave((old) => ({
                        ...old,
                        settings: {
                          ...old.settings,
                          screenShake: e.target
                            .value as Save["settings"]["screenShake"],
                        },
                      }))
                    }
                  >
                    <option value="off">Off</option>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={save.settings.reducedMotion}
                    onChange={(e) =>
                      setSave((s) => ({
                        ...s,
                        settings: {
                          ...s.settings,
                          reducedMotion: e.target.checked,
                        },
                      }))
                    }
                  />
                  Reduce motion (screen shake off)
                </label>
              </div>
              <Button
                onClick={() => {
                  if (engine.current) engine.current.hasDug = false;
                  setSave((old) => ({ ...old, hintSeen: false }));
                  setSnapshot(engine.current?.snapshot() ?? null);
                  setShowHint(true);
                  closeModal();
                }}
              >
                Show digging hint again
              </Button>
              <p className="muted">
                To finish safely, return to the surface and choose Retire
                safely.
              </p>
            </>
          )}
          {modal === "wallet" && (
            <>
              <p>
                Sign in with a message to use your address as a miner name. No
                payment or transaction is needed to play.
              </p>
              {address ? (
                <>
                  <p className="wallet-address">{address}</p>
                  <Button
                    onClick={() => {
                      setAddress("");
                      provider.current = undefined;
                      setSave((s) => ({ ...s, name: "Pip" }));
                      setWalletNote("Disconnected from this game.");
                    }}
                  >
                    Disconnect wallet
                  </Button>
                </>
              ) : (
                <>
                  {wallets.map((w) => (
                    <Button
                      key={w.id}
                      onClick={() => void connect(w)}
                      disabled={!!pending}
                    >
                      {pending === w.id
                        ? "Waiting for wallet…"
                        : `Connect ${w.name}`}
                    </Button>
                  ))}
                  {!wallets.length && (
                    <p className="inline-note">
                      No browser wallet detected. Open this page in your
                      wallet’s browser, or install an Ethereum wallet extension.
                      You can keep playing without one.
                    </p>
                  )}
                  <div className="wallet-links">
                    <a
                      href={`https://link.metamask.io/dapp/${location.href.replace(/^https?:\/\//, "")}`}
                    >
                      Open in MetaMask ↗
                    </a>
                    <a
                      href={`https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(location.href)}`}
                    >
                      Open in Coinbase Wallet ↗
                    </a>
                    <a
                      href={`https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`}
                    >
                      Open in Phantom ↗
                    </a>
                  </div>
                </>
              )}
              <p className="wallet-note" role="status">
                {walletNote}
              </p>
              <Button onClick={closeModal}>Keep playing</Button>
            </>
          )}
          {modal === "share" && result && (
            <>
              {shareURL ? (
                <img
                  className="share-preview"
                  src={shareURL}
                  alt={`Squeek Deep run: ${result.depth}m, ${result.hoard} seeds hoarded, best haul ${result.best}`}
                />
              ) : (
                <p>Drawing your share card…</p>
              )}
              <div className="share-actions">
                <Button
                  variant="gold"
                  disabled={!shareBlob}
                  onClick={() => {
                    if (shareBlob) {
                      downloadCard(shareBlob, result);
                      setNotice(
                        "PNG downloaded. A little treasure for your camera roll.",
                      );
                    }
                  }}
                >
                  Download PNG
                </Button>
                <Button
                  disabled={!shareBlob}
                  onClick={() => {
                    if (shareBlob)
                      void copyCard(shareBlob)
                        .then(() => setNotice("Image copied. Ready to paste."))
                        .catch((e) => setNotice(e.message));
                  }}
                >
                  Copy image
                </Button>
                <a
                  className="pixel-button wood"
                  href={tweetURL(result)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share on X ↗
                </a>
              </div>
              <p className="muted">
                Download the PNG, then attach it to your post on X.
              </p>
              <p role="status">{notice}</p>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
