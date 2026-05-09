const { useState, useEffect, useMemo, useRef } = React;

// ---- Icons ----
const IconShuffle = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 3h5v5" />
    <path d="M4 20l17-17" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </svg>
);
const IconList = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h16" />
    <path d="M4 12h16" />
    <path d="M4 18h10" />
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
  const [history, setHistory] = useState([]); // recent draw indices
  const [phase, setPhase] = useState("idle"); // idle | shuffling | revealing
  const [previewIdx, setPreviewIdx] = useState(null); // card flashing during shuffle
  const [pendingIdx, setPendingIdx] = useState(null); // card chosen, mounted hidden during shuffle so it's pre-decoded
  const shuffleTimers = useRef([]);
  const audioRef = useRef(null);

  // Preload the shuffle sound
  useEffect(() => {
    const a = new Audio("shuffle.wav");
    a.preload = "auto";
    a.volume = 0.85;
    audioRef.current = a;
  }, []);

  // Preload PNGs before allowing draws
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
    if (cards.length === 0 || phase !== "idle") return;
    clearTimers();

    // ---- "Feels random" logic ----
    // Avoid the most-recently-drawn cards. With N cards, hold back roughly
    // the last N/3 draws (min 2, max 8) so a card needs some breathing room
    // before it can come back. With 1 card we have to allow it.
    const N = cards.length;
    const holdBack = Math.min(8, Math.max(2, Math.floor(N / 3)));
    const recent = history.slice(-Math.min(holdBack, N - 1));
    let pool = cards.map((_, i) => i).filter((i) => !recent.includes(i));
    if (pool.length === 0) pool = cards.map((_, i) => i);
    const next = pool[Math.floor(Math.random() * pool.length)];

    // ---- Shuffle: show card backs while the deck riffles ----
    setPhase("shuffling");
    setPendingIdx(next); // mounts the chosen image hidden so it decodes during the shuffle
    const SHUFFLE_MS = 1250;

    // Play the shuffle sound
    const a = audioRef.current;
    if (a) {
      try {
        a.currentTime = 0;
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* ignore */ }
    }

    // Force a fresh decode of the chosen image so it's pixel-ready before reveal
    const decodePromise = (() => {
      const img = new Image();
      img.src = cards[next].file;
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    })();
    const delayPromise = new Promise((res) => {
      shuffleTimers.current.push(setTimeout(res, SHUFFLE_MS));
    });

    Promise.all([decodePromise, delayPromise]).then(() => {
      setCurrentIdx(next);
      setHistory((prev) => [...prev, next].slice(-12));
      setPhase("revealing");
      setPendingIdx(null);
      shuffleTimers.current.push(
        setTimeout(() => setPhase("idle"), 650)
      );
    });
  }

  const currentCard = currentIdx != null ? cards[currentIdx] : null;

  return (
    <div className="app">
      <div className="paper-tex" />
      <DrawView
        cards={cards}
        currentCard={currentCard}
        pendingIdx={pendingIdx}
        phase={phase}
        hasDrawn={currentIdx != null}
        ready={ready}
        loadedPct={totalToLoad ? Math.round((loaded / totalToLoad) * 100) : 0}
        onDraw={pickRandom}
      />
    </div>
  );
}

function DrawView({ cards, currentCard, pendingIdx, phase, hasDrawn, ready, loadedPct, onDraw }) {
  const empty = cards.length === 0;
  const shuffling = phase === "shuffling";
  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">
          <Compass size={34} />
          <div className="brand-text">
            <div className="kicker">Map randomizer</div>
            <h1>Den Forbudte Øya</h1>
          </div>
        </div>
      </header>

      <main className="stage">
        <div className="card-stack">
          {/* decorative back layers — only visible during shuffle */}
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
            {/* Pre-mount the chosen card image during shuffle so it's decoded
                and pixel-ready by the time we flip — no blank flash. */}
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

      <footer className="actions">
        {!empty && (
          <button className="btn btn-primary" onClick={onDraw} disabled={shuffling || !ready}>
            <IconShuffle />
            <span>
              {!ready
                ? `Laster bilder… ${loadedPct}%`
                : shuffling
                ? "Stokker…"
                : hasDrawn
                ? "Trekk på nytt"
                : "Trekk tilfeldig kart"}
            </span>
          </button>
        )}
        {!empty && !ready && (
          <div className="meta">
            <span className="meta-dot meta-dot-loading" />
            <span>Laster {cards.length + 1} bilder</span>
          </div>
        )}
      </footer>
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

function ReadyState({ count }) {
  return (
    <div className="ready">
      <div className="ready-mark"><Compass size={56} /></div>
      <p className="ready-text">{count} kart venter</p>
      <p className="ready-sub">Trykk på knappen under for å trekke</p>
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
  // Random per-mount filter to make each "new" back look slightly different,
  // as if it's actually a different physical card.
  const filter = useMemo(() => {
    const b = (0.88 + Math.random() * 0.24).toFixed(3);     // 0.88 – 1.12
    const c = (0.92 + Math.random() * 0.18).toFixed(3);     // 0.92 – 1.10
    const h = (Math.random() * 14 - 7).toFixed(1);          // -7 – +7 deg
    const s = (0.92 + Math.random() * 0.16).toFixed(3);     // 0.92 – 1.08
    return `brightness(${b}) contrast(${c}) hue-rotate(${h}deg) saturate(${s})`;
  }, [flicker, idle]);
  return (
    <div className={`card-shown card-back ${flicker ? "is-flicker" : ""} ${idle ? "is-idle" : ""}`}>
      <img src={window.CARD_BACK} alt="" style={{ filter }} />
    </div>
  );
}

function ListView({ cards, onBack }) {
  return (
    <div className="screen">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Tilbake">
          <IconBack />
        </button>
        <div className="brand brand-center">
          <div className="brand-text">
            <div className="kicker">Bunken</div>
            <h1 className="h1-small">{cards.length} kart-kort</h1>
          </div>
        </div>
        <div style={{ width: 44 }} />
      </header>

      <div className="manage-body">
        <ul className="card-list">
          {cards.map((c) => (
            <li key={c.file} className="card-row">
              <div className="thumb">
                <img src={c.file} alt={c.name} />
              </div>
              <div className="row-main">
                <div className="row-name">{c.name}</div>
                <div className="row-file">{c.file}</div>
              </div>
            </li>
          ))}
        </ul>
        <p className="storage-note">
          Endre listen i <code>cards.js</code> for å legge til eller fjerne kort.
        </p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
