const { useState, useEffect, useMemo, useRef } = React;

// ---- Icons ----
const IconUndo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M3 13C5 8.5 9.5 6 13.5 6a8.5 8.5 0 0 1 7.5 7.5" />
  </svg>
);

const IconBack = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

const Compass = ({ size = 56 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
    <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="0.8" opacity="0.35" />
    <path d="M32 8 L35 32 L32 56 L29 32 Z" fill="currentColor" opacity="0.85" />
    <path d="M8 32 L32 29 L56 32 L32 35 Z" fill="currentColor" opacity="0.45" />
    <circle cx="32" cy="32" r="2" fill="currentColor" />
  </svg>
);

// ---- Cards manifest ----
function getCards() {
  const raw = window.CARDS || [];
  return raw
    .filter((c) => c && (typeof c === "string" || c.file))
    .map((c, i) => {
      if (typeof c === "string") return { file: c, name: deriveName(c, i) };
      return { file: c.file, name: c.name || deriveName(c.file, i) };
    });
}
function deriveName(file, i) {
  const base = file.split("/").pop().replace(/\.[^.]+$/, "");
  return base || `Kart ${i + 1}`;
}

// ---- Main App ----
function App() {
  const cards = useMemo(getCards, []);
  const [currentIdx, setCurrentIdx] = useState(null);
  const [prevIdx, setPrevIdx] = useState(null); // one-level undo
  const [history, setHistory] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [pendingIdx, setPendingIdx] = useState(null);
  const shuffleTimers = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    const a = new Audio("shuffle.wav");
    a.preload = "auto";
    a.volume = 0.5;
    audioRef.current = a;
  }, []);

  const [loaded, setLoaded] = useState(0);
  const [totalToLoad, setTotalToLoad] = useState(0);
  useEffect(() => {
    const sources = [...cards.map((c) => c.file), window.CARD_BACK];
    setTotalToLoad(sources.length);
    setLoaded(0);
    let cancelled = false;
    sources.forEach((src) => {
      const img = new Image();
      const done = () => { if (!cancelled) setLoaded((n) => n + 1); };
      img.onload = done;
      img.onerror = done;
      img.src = src;
    });
    return () => { cancelled = true; };
  }, [cards]);
  const ready = totalToLoad > 0 && loaded >= totalToLoad;

  function clearTimers() {
    shuffleTimers.current.forEach(clearTimeout);
    shuffleTimers.current = [];
  }
  useEffect(() => clearTimers, []);

  function pickRandom() {
    if (cards.length === 0 || phase !== "idle" || !ready) return;
    clearTimers();

    const N = cards.length;
    const holdBack = Math.min(8, Math.max(2, Math.floor(N / 3)));
    const recent = history.slice(-Math.min(holdBack, N - 1));
    let pool = cards.map((_, i) => i).filter((i) => !recent.includes(i));
    if (pool.length === 0) pool = cards.map((_, i) => i);
    const next = pool[Math.floor(Math.random() * pool.length)];

    setPhase("shuffling");
    setPendingIdx(next);
    const SHUFFLE_MS = 1150;

    const a = audioRef.current;
    if (a) {
      try {
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {}
    }

    const decodePromise = (() => {
      const img = new Image();
      img.src = cards[next].file;
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    })();
    const delayPromise = new Promise((res) => {
      shuffleTimers.current.push(setTimeout(res, SHUFFLE_MS));
    });

    Promise.all([decodePromise, delayPromise]).then(() => {
      setPrevIdx(currentIdx); // save for undo
      setCurrentIdx(next);
      setHistory((prev) => [...prev, next].slice(-12));
      setPhase("revealing");
      setPendingIdx(null);
      shuffleTimers.current.push(
        setTimeout(() => setPhase("idle"), 550)
      );
    });
  }

  function undoDraw() {
    if (prevIdx === null || phase !== "idle") return;
    setCurrentIdx(prevIdx);
    setPrevIdx(null);
    setHistory((prev) => prev.slice(0, -1));
  }

  const currentCard = currentIdx != null ? cards[currentIdx] : null;
  const canUndo = prevIdx !== null && phase === "idle";

  return (
    <div className="app">
      <div className="paper-tex" />
      <DrawView
        cards={cards}
        currentCard={currentCard}
        pendingIdx={pendingIdx}
        phase={phase}
        ready={ready}
        loadedPct={totalToLoad ? Math.round((loaded / totalToLoad) * 100) : 0}
        canUndo={canUndo}
        onDraw={pickRandom}
        onUndo={undoDraw}
      />
    </div>
  );
}

function DrawView({ cards, currentCard, pendingIdx, phase, ready, loadedPct, canUndo, onDraw, onUndo }) {
  const empty = cards.length === 0;
  const shuffling = phase === "shuffling";
  const tappable = !empty && !shuffling && ready;

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">
          <Compass size={34} />
          <div className="brand-text">
            <div className="kicker">
              {!ready && !empty ? `Laster… ${loadedPct}%` : "Map randomizer"}
            </div>
            <h1>Den Forbudte Øya</h1>
          </div>
        </div>
        <button
          className={`icon-btn undo-btn ${canUndo ? "undo-visible" : ""}`}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Angre"
        >
          <IconUndo />
        </button>
      </header>

      <main className="stage">
        <div
          className={`card-stack ${tappable ? "card-stack-tap" : ""}`}
          onClick={tappable ? onDraw : undefined}
          role={tappable ? "button" : undefined}
          tabIndex={tappable ? 0 : undefined}
          onKeyDown={tappable ? (e) => e.key === "Enter" || e.key === " " ? onDraw() : null : undefined}
          aria-label="Trekk tilfeldig kart"
        >
          <div className={`stack-layer layer-3 ${shuffling ? "show shake-3" : ""}`} style={shuffling ? null : { transform: "translate(7px, 9px) rotate(2.6deg)" }} />
          <div className={`stack-layer layer-2 ${shuffling ? "show shake-2" : ""}`} style={shuffling ? null : { transform: "translate(-5px, 6px) rotate(-2.1deg)" }} />
          <div className={`stack-layer layer-1 ${shuffling ? "show shake-1" : ""}`} style={shuffling ? null : { transform: "translate(3px, 3px) rotate(1.2deg)" }} />

          <div
            className={`card-frame ${shuffling ? "is-shuffling has-card" : ""} ${currentCard && !shuffling ? "has-card" : !shuffling && !empty ? "has-card" : ""}`}
          >
            {empty ? (
              <EmptyState />
            ) : shuffling ? (
              <CardBack flicker />
            ) : currentCard ? (
              <CardDisplay card={currentCard} phase={phase} />
            ) : (
              <CardBack idle />
            )}
            {pendingIdx != null && (
              <img
                src={cards[pendingIdx].file}
                alt=""
                aria-hidden="true"
                decoding="sync"
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-mark"><Compass size={68} /></div>
      <h2>Bunken er tom</h2>
      <p>
        Legg bildefilene i <code>/cards/</code> og register dem i{" "}
        <code>cards.js</code>.
      </p>
    </div>
  );
}

function CardDisplay({ card, phase }) {
  const [error, setError] = useState(false);
  useEffect(() => setError(false), [card.file]);
  const animClass = phase === "revealing" ? "anim-reveal" : "";
  return (
    <div key={card.file} className={`card-shown ${animClass}`}>
      {error ? (
        <div className="card-error">
          <p>Fant ikke bildet</p>
          <code>{card.file}</code>
        </div>
      ) : (
        <img src={card.file} alt={card.name} onError={() => setError(true)} />
      )}
    </div>
  );
}

function CardBack({ flicker, idle }) {
  const filter = useMemo(() => {
    const b = (0.88 + Math.random() * 0.24).toFixed(3);
    const c = (0.92 + Math.random() * 0.18).toFixed(3);
    const h = (Math.random() * 14 - 7).toFixed(1);
    const s = (0.92 + Math.random() * 0.16).toFixed(3);
    return `brightness(${b}) contrast(${c}) hue-rotate(${h}deg) saturate(${s})`;
  }, [flicker, idle]);
  return (
    <div className={`card-shown card-back ${flicker ? "is-flicker" : ""} ${idle ? "is-idle" : ""}`}>
      <img src={window.CARD_BACK} alt="" style={{ filter }} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
