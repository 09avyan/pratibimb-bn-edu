"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { NEWS_LIBRARY, findStock } from "@/lib/market";
import { portfolioValue, secondsLeft, sessionPhase, startMarketLoop, store } from "@/lib/store";
import type { DemoState, Participant, Portfolio, Stock } from "@/lib/types";

type View = "parent" | "login" | "trading" | "test" | "audience" | "admin";
const rupee = (value: number, decimals = 0) => `₹${Math.abs(value).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
const signedRupee = (value: number) => `${value >= 0 ? "+" : "−"}${rupee(value)}`;
const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
const changePct = (now: number, before: number) => before ? ((now - before) / before) * 100 : 0;
const idStorage = "pratibimb.activeParticipant";

export default function DalaalApp({ view }: { view: View }) {
  const [data, setData] = useState<DemoState | null>(null);
  const [participantId, setParticipantId] = useState("");
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState("");
  const participant = data?.participants.find((p) => p.id === participantId);

  useEffect(() => {
    const stop = startMarketLoop(view === "admin");
    const unsubscribe = store.subscribe(() => setData(store.getState()));
    setData(store.getState());
    setParticipantId(window.localStorage.getItem(idStorage) || "");
    setDark(window.localStorage.getItem("pratibimb.theme") === "dark");
    return () => { unsubscribe(); stop(); };
  }, [view]);

  const toast = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 3200); };
  const toggleDark = () => setDark((was) => { window.localStorage.setItem("pratibimb.theme", was ? "light" : "dark"); return !was; });
  if (!data) return <main className="loading-shell"><div className="brand-mark">P</div><p>Opening the market terminal…</p></main>;

  if (view === "audience") return <Audience data={data} />;
  if (view === "admin") return <Admin data={data} toast={toast} notice={notice} />;
  if (view === "login") return <Login data={data} toast={toast} notice={notice} onLogin={(p) => { window.localStorage.setItem(idStorage, p.id); setParticipantId(p.id); window.location.href = "/parent"; }} />;
  if (view === "parent") return <Shell dark={dark} toggleDark={toggleDark} active={participant?.displayName}>
    <ParentDashboard data={data} participant={participant} toast={toast} />
  </Shell>;
  return <Shell dark={dark} toggleDark={toggleDark} active={participant?.displayName}>
    <Terminal data={data} participant={view === "test" ? undefined : participant} testMode={view === "test"} toast={toast} notice={notice} />
  </Shell>;
}

function Shell({ children, dark, toggleDark, active }: { children: ReactNode; dark: boolean; toggleDark: () => void; active?: string }) {
  return <div className={`app-shell ${dark ? "theme-dark" : ""}`}>
    <header className="topbar">
      <Link className="brand" href="/parent"><span className="brand-mark">P</span><span><strong>PRATIBIMB</strong><small>BUSINESS EDUCATION</small></span></Link>
      <div className="top-links"><Link href="/parent">Overview</Link><Link href="/dalaal-street">Dalaal Street</Link><Link href="/dalaal-street/audience">Audience</Link></div>
      <div className="top-actions"><span className="market-live"><i /> MARKET LIVE</span><button className="icon-button" onClick={toggleDark} aria-label="Toggle colour theme">{dark ? "☼" : "◐"}</button>{active ? <span className="user-chip"><span className="avatar">{active[0]?.toUpperCase()}</span>{active}</span> : <Link className="button button-small" href="/parent/login">Parent login</Link>}</div>
    </header>
    <div className="shell-content">{children}</div>
    <footer className="footnote">Simulation prices — not live market data <span>•</span> Pratibimb · Business Education</footer>
  </div>;
}

function Login({ data, toast, notice, onLogin }: { data: DemoState; toast: (s: string) => void; notice: string; onLogin: (p: Participant) => void }) {
  const [tab, setTab] = useState<"login" | "register">("register");
  const [name, setName] = useState(""); const [username, setUsername] = useState(""); const [pin, setPin] = useState(""); const [suggestion, setSuggestion] = useState("");
  const baseUsername = (name: string) => name.toLowerCase().trim().normalize("NFKD").replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "parent";
  const nextUsername = (base: string) => { if (!data.participants.some((p) => p.username === base)) return base; let n = 2; while (data.participants.some((p) => p.username === `${base}${n}`)) n++; return `${base}${n}`; };
  const suggested = nextUsername(baseUsername(name));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    try {
      if (tab === "register") {
        const person = store.register(name, username || suggested, pin);
        window.localStorage.setItem(idStorage, person.id); window.location.href = "/parent";
      } else onLogin(store.login(username, pin));
    } catch (error) { const message = error instanceof Error ? error.message : "Could not continue."; if (message.includes("taken")) setSuggestion(suggested); toast(message); }
  };
  return <Shell dark={false} toggleDark={() => {}}><div className="login-layout"><div className="login-copy"><span className="eyebrow">PRATIBIMB · PARENT ACCESS</span><h1>Make your next<br />market move count.</h1><p>Register once to keep your Dalaal Street session, portfolio and results in one place.</p><div className="login-proof"><span>₹10 lakh</span><small>virtual capital</small><span>10 minutes</span><small>to trade</small></div></div><form className="login-card" onSubmit={submit}><div className="form-tabs"><button type="button" className={tab === "register" ? "selected" : ""} onClick={() => setTab("register")}>Create account</button><button type="button" className={tab === "login" ? "selected" : ""} onClick={() => setTab("login")}>Sign in</button></div><h2>{tab === "register" ? "Welcome to Dalaal Street" : "Welcome back"}</h2><p className="muted">{tab === "register" ? "A name, username and PIN is all you need." : "Continue with your demo username and PIN."}</p>
      {tab === "register" && <label>Your name<input value={name} onChange={(e) => { setName(e.target.value); setUsername(""); setSuggestion(""); }} placeholder="e.g. Rahul Sharma" required autoComplete="name" /></label>}
      <label>Username<div className="input-with-action"><input value={username || (tab === "register" ? suggested : "")} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder={tab === "register" ? suggested : "Your username"} required autoComplete="username" />{tab === "register" && name && <button className="use-suggestion" type="button" onClick={() => setUsername(suggested)}>Use {suggested}</button>}</div></label>
      {suggestion && <p className="suggestion">That username is taken. Try <button type="button" onClick={() => { setUsername(suggestion); setSuggestion(""); }}>{suggestion}</button></p>}
      <label>PIN <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" minLength={4} maxLength={6} placeholder="4–6 digits" required type="password" autoComplete="current-password" /></label>
      {notice && <div className="inline-alert">{notice}</div>}<button className="button button-primary button-full" type="submit">{tab === "register" ? "Create my account" : "Sign in"}<span>→</span></button><p className="privacy-note">Demo access is stored in this browser. No email or phone number needed.</p>
    </form></div></Shell>;
}

function ParentDashboard({ data, participant, toast }: { data: DemoState; participant?: Participant; toast: (s: string) => void }) {
  if (!participant) return <div className="empty-login page-narrow"><div className="eyebrow">YOUR PRATIBIMB DASHBOARD</div><h1>One place for your market session.</h1><p>Sign in or create an account to see your portfolio and results.</p><Link className="button button-primary" href="/parent/login">Continue to parent access <span>→</span></Link></div>;
  const value = portfolioValue(participant.portfolio, data.market); const start = participant.session.startingValue || 1_000_000; const ret = (value / start - 1) * 100;
  const rankList = completedRank(data); const rank = rankList.findIndex((p) => p.id === participant.id) + 1;
  const session = participant.session;
  const goSession = () => {
    if (session.status === "idle") store.startSession(participant.id);
    else if (session.status === "paused") store.pauseSession(participant.id);
    else if (session.status === "trading" || session.status === "closing") { toast("Your session is already running. The clock will keep your remaining time."); }
    window.location.href = "/dalaal-street";
  };
  return <div className="dashboard-wrap">
    <div className="page-heading"><div><span className="eyebrow">PARENT DASHBOARD</span><h1>Good day, {participant.displayName.split(" ")[0]}.</h1><p>Here’s how your Pratibimb activity is going.</p></div><Link className="button button-outline" href="/dalaal-street/audience">Open audience board ↗</Link></div>
    <div className="summary-strip"><div><span>PORTFOLIO VALUE</span><strong>{rupee(session.status === "completed" ? session.endingValue || value : value)}</strong><small className={ret >= 0 ? "positive" : "negative"}>{session.status === "idle" ? "Session not started" : `${pct(ret)} return`}</small></div><div><span>DALAAL 10 SESSION</span><strong>{session.status === "completed" ? pct(changePct(session.endingIndex || data.market.index, session.startingIndex || data.market.index)) : `${data.market.index.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}</strong><small>Market continues between sessions</small></div><div><span>RELATIVE PERFORMANCE</span><strong className={ret >= 0 ? "positive" : "negative"}>{session.status === "completed" ? pct(ret - changePct(session.endingIndex || data.market.index, session.startingIndex || data.market.index)) : "—"}</strong><small>Compared with Dalaal 10</small></div><div><span>LEADERBOARD</span><strong>{session.status === "completed" && rank ? `#${rank}` : "—"}</strong><small>Completed sessions only</small></div></div>
    <div className="dashboard-grid"><section className="activity-card"><div className="activity-brand"><span className="activity-icon">↗</span><span><b>DALAAL STREET</b><small>Market simulation · 10 minute session</small></span><span className="pill pill-live"><i /> MARKET OPEN</span></div><p>Build a portfolio, read the headlines and see how your decisions compare with the market.</p><div className="activity-bottom"><div><span className="label-small">SESSION STATUS</span><b className="session-status">{session.status === "idle" ? "Ready when you are" : session.status[0].toUpperCase() + session.status.slice(1)}</b></div><button className="button button-primary" onClick={goSession}>{session.status === "idle" ? "START SESSION" : session.status === "completed" ? "View results" : session.status === "paused" ? "Resume session" : "Open session"}<span>→</span></button></div></section>
      <section className="activity-card future-card"><span className="future-label">COMING TO PRATIBIMB</span><h3>More ways to put business learning into practice.</h3><p>New activities from the Business Education Department will appear here.</p><span className="coming-soon">MORE ACTIVITIES · SOON</span></section>
    </div>
    <section className="section-card"><div className="section-title"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Your trading summary</h2></div>{participant.session.status !== "idle" && <span className={`pill ${participant.session.status === "completed" ? "pill-neutral" : "pill-live"}`}>{participant.session.status.toUpperCase()}</span>}</div>{participant.session.status === "idle" ? <p className="empty-state">Your trades and results will show here after you begin a session.</p> : <div className="trade-summary"><div><span>Trades completed</span><b>{participant.portfolio.trades.length}</b></div><div><span>Holdings</span><b>{Object.values(participant.portfolio.positions).filter((p) => p.quantity).length} stocks</b></div><div><span>Available cash</span><b>{rupee(participant.portfolio.cash)}</b></div><div><span>Last activity</span><b>{participant.portfolio.trades[0] ? new Date(participant.portfolio.trades[0].at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Session started"}</b></div></div>}</section>
  </div>;
}

function Terminal({ data, participant, testMode, toast, notice }: { data: DemoState; participant?: Participant; testMode: boolean; toast: (s: string) => void; notice: string }) {
  const [query, setQuery] = useState(""); const [sector, setSector] = useState("All sectors"); const [filter, setFilter] = useState("All stocks"); const [sort, setSort] = useState("Market cap"); const [selected, setSelected] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL" | "SHORT">("BUY"); const [orderType, setOrderType] = useState<"MARKET" | "LIMIT">("MARKET"); const [quantity, setQuantity] = useState("10"); const [limit, setLimit] = useState("");
  const [testPortfolio, setTestPortfolio] = useState<Portfolio>({ cash: 1_000_000, positions: {}, orders: [], trades: [] });
  const orderGuard = useRef(false);
  const user = participant;
  const portfolio = testMode ? testPortfolio : user?.portfolio;
  const phase = user ? sessionPhase(user.session) : "idle";
  const holdingValue = portfolio ? Object.entries(portfolio.positions).reduce((sum, [ticker, pos]) => sum + pos.quantity * (findStock(data.market, ticker)?.currentPrice || 0), 0) : 0;
  const totalValue = portfolio ? portfolio.cash + holdingValue : 1_000_000;
  const sessionReturn = user?.session.startingValue ? (totalValue / user.session.startingValue - 1) * 100 : 0;
  const selectedStock = selected ? findStock(data.market, selected) : undefined;
  const sectors = ["All sectors", ...Array.from(new Set(data.market.stocks.map((s) => s.sector)))];
  const stocks = useMemo(() => {
    let list = [...data.market.stocks];
    if (query.trim()) { const q = query.toLowerCase(); list = list.filter((s) => s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q)); }
    if (sector !== "All sectors") list = list.filter((s) => s.sector === sector);
    if (filter === "Owned") list = list.filter((s) => (portfolio?.positions[s.ticker]?.quantity || 0) !== 0);
    if (filter === "Gainers") list = list.filter((s) => changePct(s.currentPrice, s.previousPrice) > 0);
    if (filter === "Losers") list = list.filter((s) => changePct(s.currentPrice, s.previousPrice) < 0);
    list.sort((a, b) => sort === "Price" ? b.currentPrice - a.currentPrice : sort === "% change" ? changePct(b.currentPrice, b.previousPrice) - changePct(a.currentPrice, a.previousPrice) : sort === "Volume" ? b.volume - a.volume : a.name.localeCompare(b.name));
    return list;
  }, [data.market.stocks, query, sector, filter, sort, portfolio]);
  const countdown = user ? secondsLeft(user.session) : 0;
  const submitOrder = (event: FormEvent) => {
    event.preventDefault();
    if (orderGuard.current) return;
    orderGuard.current = true;
    window.setTimeout(() => { orderGuard.current = false; }, 450);
    try {
      const qty = Number(quantity);
      if (!selectedStock) throw new Error("Select a stock first.");
      if (testMode) {
        const p = testPortfolio; const pos = p.positions[selectedStock.ticker] || { quantity: 0, averagePrice: 0 }; const price = selectedStock.currentPrice; const n = Number(qty);
        if (!Number.isInteger(n) || n < 1) throw new Error("Enter a valid share quantity.");
        if (side === "BUY") { if (p.cash < price * n) throw new Error("Not enough cash."); setTestPortfolio({ ...p, cash: p.cash - price * n, positions: { ...p.positions, [selectedStock.ticker]: { quantity: pos.quantity + n, averagePrice: price } }, trades: [{ id: crypto.randomUUID(), ticker: selectedStock.ticker, side: "BUY", quantity: n, price, at: Date.now(), impact: 0 }, ...p.trades] }); }
        else if (side === "SELL") { if (pos.quantity < n) throw new Error("You don’t hold enough shares to sell."); setTestPortfolio({ ...p, cash: p.cash + price * n, positions: { ...p.positions, [selectedStock.ticker]: { ...pos, quantity: pos.quantity - n } }, trades: [{ id: crypto.randomUUID(), ticker: selectedStock.ticker, side: "SELL", quantity: n, price, at: Date.now(), impact: 0 }, ...p.trades] }); }
        else { if (n * price > 500_000) throw new Error("Test shorts are capped at ₹5 lakh."); setTestPortfolio({ ...p, cash: p.cash + price * n, positions: { ...p.positions, [selectedStock.ticker]: { quantity: pos.quantity - n, averagePrice: price } }, trades: [{ id: crypto.randomUUID(), ticker: selectedStock.ticker, side: "SHORT", quantity: n, price, at: Date.now(), impact: 0 }, ...p.trades] }); }
        store.setImpact(selectedStock.ticker, (side === "SELL" || side === "SHORT" ? -1 : 1) * Math.min(0.00028, n / selectedStock.volume * 0.025) * 0.15);
      } else {
        if (!user) throw new Error("Sign in to trade with a parent account.");
        const result = store.execute(user.id, side, selectedStock.ticker, qty, orderType, Number(limit));
        if (result.pending) { toast("Limit order placed. It will fill if the market reaches your price."); return; }
      }
      toast(`${side === "SHORT" ? "Short sale" : `${side[0]}${side.slice(1).toLowerCase()} order`} complete · ${qty} ${selectedStock.ticker}`);
    } catch (error) { toast(error instanceof Error ? error.message : "Order could not be placed."); }
  };

  return <div className="terminal-page">
    <div className="terminal-heading"><div><span className="eyebrow">PRATIBIMB · BUSINESS EDUCATION</span><h1>Dalaal Street</h1><p>Think clearly. Trade thoughtfully. See how your decisions play out.</p></div><div className="terminal-tools">{testMode && <span className="pill pill-test">TEST / SANDBOX</span>}<Link className="button button-outline" href="/parent">My dashboard</Link></div></div>
    {testMode && <div className="test-banner"><b>TEST / SANDBOX</b><span>Trades here are temporary and aren’t ranked. Test trades have a lighter effect on the simulated market.</span></div>}
    {!testMode && !user && <div className="signin-banner"><span>Sign in to save a portfolio and start your 10-minute session.</span><Link className="button button-primary button-small" href="/parent/login">Parent access →</Link></div>}
    <div className="terminal-kpis">
      <div className="index-kpi"><div className="kpi-label"><span>DALAAL 10</span><span className="pill pill-live"><i /> {data.market.running ? "MARKET OPEN" : "PAUSED"}</span></div><div className="index-number">{data.market.index.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className={changePct(data.market.index, 10_000) >= 0 ? "positive" : "negative"}>{signedRupee(data.market.index - 10_000)} <span className="tiny-muted">index pts</span> &nbsp; {pct(changePct(data.market.index, 10_000))}</div></div>
      <MiniChart values={data.market.indexHistory} positive={data.market.index >= 10_000} className="index-chart" />
      <div className="timer-kpi"><span className="kpi-label">{user ? phase === "closing" ? "CLOSING WINDOW" : "TRADING SESSION" : "SESSION LENGTH"}</span><strong>{user && (phase === "trading" || phase === "closing" || phase === "paused") ? `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}` : "10:00"}</strong><small>{user ? phase === "closing" ? "Sell, cover or cancel" : phase === "paused" ? "Paused · your time is saved" : phase === "completed" ? "Session complete" : phase === "idle" ? "Starts when you choose" : "Time remaining" : "Start only when ready"}</small>{user && (phase === "trading" || phase === "closing" || phase === "paused") && <button className="text-action" onClick={() => { if (confirm("Ending now does not reset your timer. If you return later, only your remaining time will be available. Continue?")) store.pauseSession(user.id); }}>Pause / resume session</button>}</div>
      <div className="portfolio-kpi"><span className="kpi-label">PORTFOLIO VALUE</span><strong>{rupee(totalValue)}</strong><small>{portfolio ? `${rupee(portfolio.cash)} available cash` : "₹10,00,000 starting cash"}</small></div>
      <div className="pnl-kpi"><span className="kpi-label">SESSION P&amp;L</span><strong className={sessionReturn >= 0 ? "positive" : "negative"}>{signedRupee(totalValue - (user?.session.startingValue || 1_000_000))}</strong><small className={sessionReturn >= 0 ? "positive" : "negative"}>{pct(sessionReturn)} return</small></div>
    </div>
    {user?.session.status === "idle" && <div className="session-callout"><div><b>Your clock starts when you do.</b><span>Once started, the 10-minute timer keeps running even if you leave the page.</span></div><button className="button button-primary" onClick={() => store.startSession(user.id)}>START SESSION <span>→</span></button></div>}
    {user?.session.status === "completed" && <ResultCard participant={user} marketIndex={data.market.index} rank={completedRank(data).findIndex((p) => p.id === user.id) + 1} />}
    {data.market.activeNews.length > 0 && <div className="news-strip"><span className="news-dot">●</span><b>MARKET NEWS</b><span>{data.market.activeNews[0].headline}</span><small>{new Date(data.market.activeNews[0].createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></div>}
    <div className="market-layout">
      <section className="market-panel"><div className="panel-head"><div><span className="eyebrow">NSE · SIMULATED</span><h2>Market watch <span className="stock-count">{stocks.length} instruments</span></h2></div><label className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search company or ticker" /></label></div>
        <div className="market-filters"><div className="filter-pills">{["All stocks", "Gainers", "Losers", "Owned"].map((option) => <button key={option} className={filter === option ? "active" : ""} onClick={() => setFilter(option)}>{option}</button>)}</div><select value={sector} onChange={(e) => setSector(e.target.value)} aria-label="Filter sector">{sectors.map((s) => <option key={s}>{s}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort stocks"><option>Market cap</option><option>Price</option><option>% change</option><option>Volume</option></select></div>
        <div className="stock-table-wrap"><table className="stock-table"><thead><tr><th>INSTRUMENT</th><th>PRICE</th><th>CHART</th><th>CHANGE</th><th>VOLUME</th><th>OWNED</th></tr></thead><tbody>{stocks.map((stock) => <StockRow key={stock.ticker} stock={stock} owned={portfolio?.positions[stock.ticker]?.quantity || 0} onClick={() => { setSelected(stock.ticker); setSide((portfolio?.positions[stock.ticker]?.quantity || 0) < 0 ? "BUY" : "BUY"); }} />)}</tbody></table>{stocks.length === 0 && <p className="empty-state">No stocks match those filters.</p>}</div>
        <div className="panel-foot">Prices update every 1.5 seconds while the demo is open <span>·</span> Click a stock to place an order</div>
      </section>
      <aside className="portfolio-panel"><div className="panel-head compact"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>{testMode ? "Sandbox portfolio" : user ? user.displayName : "Portfolio"}</h2></div><span className="pill pill-neutral">{testMode ? "TEST" : user?.session.status.toUpperCase() || "GUEST"}</span></div>
        <div className="account-summary"><div><span>AVAILABLE CASH</span><b>{rupee(portfolio?.cash || 1_000_000)}</b></div><div><span>HOLDINGS VALUE</span><b>{holdingValue < 0 ? signedRupee(holdingValue) : rupee(holdingValue)}</b></div><div><span>TOTAL VALUE</span><b>{rupee(totalValue)}</b></div></div>
        <div className="holdings-head"><b>POSITIONS</b><span>{Object.values(portfolio?.positions || {}).filter((p) => p.quantity !== 0).length} holdings</span></div>
        {!portfolio || Object.entries(portfolio.positions).filter(([, p]) => p.quantity).length === 0 ? <div className="empty-holdings"><span>▤</span><b>No holdings yet</b><small>Your first position will appear here.</small><button className="text-action" onClick={() => setSelected("RELIANCE")}>Explore stocks →</button></div> : <div className="holding-list">{Object.entries(portfolio.positions).filter(([, pos]) => pos.quantity).map(([ticker, pos]) => { const s = findStock(data.market, ticker); if (!s) return null; const pnl = (s.currentPrice - pos.averagePrice) * pos.quantity; return <button className="holding-row" key={ticker} onClick={() => setSelected(ticker)}><span className="holding-symbol">{ticker.slice(0, 2)}</span><span className="holding-name"><b>{ticker}</b><small>{pos.quantity > 0 ? `${pos.quantity} shares` : `${Math.abs(pos.quantity)} short`}</small></span><span className="holding-value"><b>{rupee(Math.abs(pos.quantity) * s.currentPrice)}</b><small className={pnl >= 0 ? "positive" : "negative"}>{signedRupee(pnl)}</small></span></button>; })}</div>}
        <div className="orders-head"><b>OPEN ORDERS</b><span>{portfolio?.orders.length || 0}</span></div>{portfolio?.orders.map((order) => <div className="pending-row" key={order.id}><span>{order.side} {order.quantity} {order.ticker} @ {rupee(order.limitPrice, 2)}</span>{user && <button onClick={() => store.cancelOrder(user.id, order.id)} aria-label="Cancel order">×</button>}</div>)}
        <div className="trade-history"><div className="holdings-head"><b>RECENT TRADES</b><span>{portfolio?.trades.length || 0}</span></div>{portfolio?.trades.length ? portfolio.trades.slice(0, 4).map((trade) => <div className="history-row" key={trade.id}><span className={`trade-side ${trade.side.toLowerCase()}`}>{trade.side}</span><b>{trade.ticker}</b><span>{trade.quantity} × {rupee(trade.price, 2)}</span></div>) : <p className="tiny-muted">Completed orders will appear here.</p>}</div>
      </aside>
    </div>
    {selectedStock && <StockDrawer stock={selectedStock} data={data} position={portfolio?.positions[selectedStock.ticker]} side={side} setSide={setSide} orderType={orderType} setOrderType={setOrderType} quantity={quantity} setQuantity={setQuantity} limit={limit} setLimit={setLimit} cash={portfolio?.cash || 1_000_000} onClose={() => setSelected("")} onSubmit={submitOrder} />}
    {notice && <div className="toast-message">{notice}</div>}
  </div>;
}

function StockRow({ stock, owned, onClick }: { stock: Stock; owned: number; onClick: () => void }) {
  const delta = changePct(stock.currentPrice, stock.previousPrice);
  return <tr className="stock-row" onClick={onClick}><td><div className="instrument"><span className="ticker-logo">{stock.ticker.slice(0, 2)}</span><span><b>{stock.name}</b><small>{stock.ticker} <i>·</i> {stock.sector}</small></span></div></td><td className="num-cell">{rupee(stock.currentPrice, 2)}</td><td><MiniChart values={stock.history.slice(-16)} positive={delta >= 0} className="sparkline" /></td><td className={delta >= 0 ? "positive num-cell" : "negative num-cell"}>{pct(delta)}</td><td className="num-cell muted-cell">{(stock.volume / 1000).toFixed(0)}K</td><td className="num-cell">{owned ? <span className={`owned-qty ${owned < 0 ? "negative" : ""}`}>{owned}</span> : <span className="muted-cell">—</span>}</td></tr>;
}

function MiniChart({ values, positive, className = "" }: { values: number[]; positive: boolean; className?: string }) {
  if (values.length < 2) return <span className={className} />;
  const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / range) * 24}`).join(" ");
  return <svg className={className} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={positive ? "#148568" : "#c84c54"} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function StockDrawer({ stock, data, position, side, setSide, orderType, setOrderType, quantity, setQuantity, limit, setLimit, cash, onClose, onSubmit }: { stock: Stock; data: DemoState; position?: { quantity: number; averagePrice: number }; side: "BUY" | "SELL" | "SHORT"; setSide: (s: "BUY" | "SELL" | "SHORT") => void; orderType: "MARKET" | "LIMIT"; setOrderType: (t: "MARKET" | "LIMIT") => void; quantity: string; setQuantity: (q: string) => void; limit: string; setLimit: (q: string) => void; cash: number; onClose: () => void; onSubmit: (e: FormEvent) => void }) {
  const delta = changePct(stock.currentPrice, stock.previousPrice); const qty = Number(quantity) || 0; const price = orderType === "LIMIT" && Number(limit) > 0 ? Number(limit) : stock.currentPrice;
  return <div className="drawer-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><aside className="stock-drawer"><div className="drawer-head"><div className="instrument"><span className="ticker-logo large">{stock.ticker.slice(0, 2)}</span><span><b>{stock.name}</b><small>{stock.ticker} · {stock.sector}</small></span></div><button className="icon-button" onClick={onClose}>×</button></div>
    <div className="drawer-quote"><div><span>LAST TRADED PRICE</span><strong>{rupee(stock.currentPrice, 2)}</strong></div><span className={delta >= 0 ? "positive" : "negative"}>{signedRupee(stock.currentPrice - stock.previousPrice)} &nbsp; {pct(delta)}</span></div>
    <div className="drawer-chart"><div className="chart-caption"><span>INTRADAY · SIMULATED</span><span>1D</span></div><MiniChart values={stock.history} positive={delta >= 0} className="large-chart" /><div className="chart-ends"><span>Earlier</span><span>Now</span></div></div>
    <div className="drawer-position"><span>YOUR POSITION</span><b>{position?.quantity ? `${position.quantity} shares` : "No shares held"}</b><small>{position?.quantity ? `${rupee(position.quantity * stock.currentPrice)} market value` : "Build your position with an order"}</small></div>
    {data.market.activeNews.filter((n) => n.targets.includes(stock.ticker) || n.targets.includes(stock.sector) || n.targets.includes("MARKET")).slice(0, 2).map((news) => <div className="drawer-news" key={news.id}><span className="eyebrow">RELATED NEWS · {news.category.toUpperCase()}</span><p>{news.headline}</p></div>)}
    <form className="order-form" onSubmit={onSubmit}><div className="side-tabs">{(["BUY", "SELL", "SHORT"] as const).map((s) => <button type="button" key={s} className={`${side === s ? "selected" : ""} ${s.toLowerCase()}`} onClick={() => setSide(s)}>{s === "SHORT" ? "Short" : s[0] + s.slice(1).toLowerCase()}</button>)}</div>
      <div className="order-type-tabs"><button type="button" className={orderType === "MARKET" ? "selected" : ""} onClick={() => setOrderType("MARKET")}>Market</button><button type="button" className={orderType === "LIMIT" ? "selected" : ""} onClick={() => setOrderType("LIMIT")}>Limit</button></div>
      {orderType === "LIMIT" && <label>Limit price<input value={limit} onChange={(e) => setLimit(e.target.value)} type="number" min="0.01" step="0.01" placeholder={stock.currentPrice.toFixed(2)} required /></label>}
      <label>Quantity <span className="field-hint">Shares</span><input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))} type="number" min="1" max="100000" step="1" required /></label>
      <div className="order-estimate"><span>Estimated value</span><b>{rupee(qty * price, 2)}</b></div><p className="slippage-note">Large orders may execute slightly away from the displayed price because limited quantity is available at that price.</p>
      <button className={`button button-full ${side === "SELL" || side === "SHORT" ? "button-danger" : "button-primary"}`} type="submit">{orderType === "LIMIT" ? `Place limit ${side.toLowerCase()}` : `${side === "SHORT" ? "Short sell" : `${side[0]}${side.slice(1).toLowerCase()}`} ${stock.ticker}`}<span>→</span></button><p className="available-note">Available cash <b>{rupee(cash)}</b></p>
    </form>
  </aside></div>;
}

function completedRank(data: DemoState) { return data.participants.filter((p) => p.session.status === "completed" && p.session.startingValue).sort((a, b) => ((b.session.endingValue || 0) / (b.session.startingValue || 1)) - ((a.session.endingValue || 0) / (a.session.startingValue || 1))); }

function ResultCard({ participant, marketIndex, rank }: { participant: Participant; marketIndex: number; rank: number }) {
  const start = participant.session.startingValue || 1_000_000; const end = participant.session.endingValue || start; const returns = (end / start - 1) * 100; const marketReturn = changePct(participant.session.endingIndex || marketIndex, participant.session.startingIndex || marketIndex);
  return <section className="result-card"><div><span className="eyebrow">SESSION COMPLETE</span><h2>Your market close</h2><p>Every decision is part of the learning. Here’s your result for this session.</p></div><div className="result-metrics"><div><span>FINAL PORTFOLIO</span><b>{rupee(end)}</b></div><div><span>YOUR RETURN</span><b className={returns >= 0 ? "positive" : "negative"}>{pct(returns)}</b></div><div><span>DALAAL 10</span><b>{pct(marketReturn)}</b></div><div><span>RELATIVE</span><b className={returns - marketReturn >= 0 ? "positive" : "negative"}>{pct(returns - marketReturn)}</b></div><div><span>FINAL RANK</span><b>{rank ? `#${rank}` : "—"}</b></div></div><div className="result-trades"><div className="result-trades-head"><b>TRADE HISTORY</b><span>{participant.portfolio.trades.length} trades · {signedRupee(end - start)} net portfolio change</span></div>{participant.portfolio.trades.slice(0, 5).map((trade) => <div className="result-trade-row" key={trade.id}><b>{trade.side}</b><span>{trade.ticker}</span><span>{trade.quantity} shares</span><span>{rupee(trade.price, 2)}</span><small>{new Date(trade.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</small></div>)}</div></section>;
}

function Admin({ data, toast, notice }: { data: DemoState; toast: (s: string) => void; notice: string }) {
  const [unlocked, setUnlocked] = useState(false); const [password, setPassword] = useState(""); const [selected, setSelected] = useState(NEWS_LIBRARY[0].headline);
  const login = (e: FormEvent) => { e.preventDefault(); if (password === "pratibimb") setUnlocked(true); else toast("Demo password didn’t match."); };
  if (!unlocked) return <main className="admin-lock"><form className="login-card" onSubmit={login}><span className="eyebrow">PRATIBIMB · CONTROL ROOM</span><h2>Admin access</h2><p className="muted">Enter the demo password to manage the simulation.</p><label>Demo password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoFocus /></label>{notice && <div className="inline-alert">{notice}</div>}<button className="button button-primary button-full">Unlock admin tools →</button><small>Teacher demo password is shown in the project handoff.</small></form></main>;
  const topMovers = [...data.market.stocks].sort((a, b) => changePct(b.currentPrice, b.basePrice) - changePct(a.currentPrice, a.basePrice));
  return <Shell dark={false} toggleDark={() => {}}><div className="admin-page"><div className="page-heading"><div><span className="eyebrow">PRATIBIMB · CONTROL ROOM</span><h1>Market administration</h1><p>One control surface for the classroom market simulation.</p></div><span className={`pill ${data.market.running ? "pill-live" : "pill-neutral"}`}><i /> MARKET {data.market.running ? "RUNNING" : "PAUSED"}</span></div>
    <div className="admin-stats"><div><span>DALAAL 10</span><b>{data.market.index.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b><small className={changePct(data.market.index, 10_000) >= 0 ? "positive" : "negative"}>{pct(changePct(data.market.index, 10_000))}</small></div><div><span>MARKET ENGINE</span><b>{data.market.running ? "Active" : "Paused"}</b><small>Tick {data.market.tick.toLocaleString("en-IN")} · {new Date(data.market.lastUpdated).toLocaleTimeString("en-IN")}</small></div><div><span>PARTICIPANTS</span><b>{data.participants.length}</b><small>{data.participants.filter((p) => ["trading", "closing"].includes(p.session.status)).length} active sessions</small></div><div><span>ACTIVE NEWS</span><b>{data.market.activeNews.length}</b><small>Up to 12 recent stories</small></div></div>
    <div className="admin-grid"><section className="section-card"><div className="section-title"><div><span className="eyebrow">MARKET ENGINE</span><h2>Session controls</h2></div><span className={`status-dot ${data.market.running ? "on" : "off"}`} /></div><p className="muted">The first open market tab runs the shared simulation engine. Other tabs follow its updates.</p><div className="admin-actions"><button className="button button-primary" onClick={() => { store.setRunning(true); toast("Market started."); }}>Start / resume market</button><button className="button button-outline" onClick={() => { store.setRunning(false); toast("Market paused."); }}>Pause market</button></div><div className="mini-movers">{topMovers.slice(0, 4).map((s) => <div key={s.ticker}><b>{s.ticker}</b><span>{s.name}</span><strong className={changePct(s.currentPrice, s.basePrice) >= 0 ? "positive" : "negative"}>{pct(changePct(s.currentPrice, s.basePrice))}</strong></div>)}</div></section>
      <section className="section-card news-admin"><div className="section-title"><div><span className="eyebrow">PREPARED LIBRARY</span><h2>Release market news</h2></div></div><p className="muted">Choose a headline to shift sentiment for related companies. Parents see the story, not its direction.</p><label>Headline<select value={selected} onChange={(e) => setSelected(e.target.value)}>{NEWS_LIBRARY.map((item) => <option key={item.headline}>{item.headline}</option>)}</select></label><div className="news-meta">{NEWS_LIBRARY.find((n) => n.headline === selected)?.category} · affects {NEWS_LIBRARY.find((n) => n.headline === selected)?.targets.join(", ")} · {NEWS_LIBRARY.find((n) => n.headline === selected)?.duration}s</div><button className="button button-primary" onClick={() => { const item = NEWS_LIBRARY.find((n) => n.headline === selected)!; store.publishNews(item); toast("News released to all open demo tabs."); }}>Release headline <span>→</span></button></section></div>
    <section className="section-card participant-admin"><div className="section-title"><div><span className="eyebrow">PARTICIPANT MANAGEMENT</span><h2>Parent sessions</h2></div><span className="tiny-muted">PINs are visible in this browser demo</span></div>{data.participants.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>PARENT</th><th>USERNAME / PIN</th><th>STATUS</th><th>PORTFOLIO</th><th>CONTROLS</th></tr></thead><tbody>{data.participants.map((p) => <tr key={p.id}><td><b>{p.displayName}</b><small>Added {new Date(p.createdAt).toLocaleDateString("en-IN")}</small></td><td><b>{p.username}</b><small>PIN · {p.pin}</small></td><td><span className="pill pill-neutral">{p.session.status.toUpperCase()}</span></td><td>{rupee(portfolioValue(p.portfolio, data.market))}</td><td><div className="row-actions"><button className="button button-small button-outline" disabled={p.session.status === "idle" || p.session.status === "completed"} onClick={() => store.pauseSession(p.id)}>{p.session.status === "paused" ? "Resume" : "Pause"}</button><button className="text-action" onClick={() => toast(`New PIN for ${p.username}: ${store.resetPin(p.id)}`)}>Reset PIN</button>{p.session.status !== "idle" && p.session.status !== "completed" && <button className="text-danger" onClick={() => store.finishSession(p.id)}>End session</button>}</div></td></tr>)}</tbody></table></div> : <p className="empty-state">Registered parents will appear here.</p>}</section>
    <section className="section-card"><div className="section-title"><div><span className="eyebrow">LIVE MARKET</span><h2>All 25 simulated companies</h2></div><span className="tiny-muted">No manual price edits</span></div><div className="admin-stock-grid">{data.market.stocks.map((s) => <div key={s.ticker}><b>{s.ticker}</b><span>{s.name}</span><strong>{rupee(s.currentPrice, 2)}</strong><small className={changePct(s.currentPrice, s.basePrice) >= 0 ? "positive" : "negative"}>{pct(changePct(s.currentPrice, s.basePrice))}</small></div>)}</div></section>
  </div>{notice && <div className="toast-message">{notice}</div>}</Shell>;
}

function Audience({ data }: { data: DemoState }) {
  const movers = [...data.market.stocks].sort((a, b) => changePct(b.currentPrice, b.basePrice) - changePct(a.currentPrice, a.basePrice)); const ranks = completedRank(data).slice(0, 10);
  return <main className="audience-screen"><header className="audience-top"><Link href="/parent" className="brand"><span className="brand-mark">P</span><span><strong>PRATIBIMB</strong><small>BUSINESS EDUCATION</small></span></Link><div className="audience-title">DALAAL STREET <span>LIVE MARKET</span></div><span className={`pill ${data.market.running ? "pill-live" : "pill-neutral"}`}><i /> MARKET {data.market.running ? "OPEN" : "PAUSED"}</span><span className="audience-clock">{new Date(data.market.lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></header>
    <div className="audience-main"><section className="audience-index"><span className="eyebrow">PRATIBIMB BROAD MARKET · DALAAL 10</span><div className="audience-index-row"><strong>{data.market.index.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><span className={changePct(data.market.index, 10_000) >= 0 ? "positive" : "negative"}>{signedRupee(data.market.index - 10_000)} <small>pts</small> &nbsp; {pct(changePct(data.market.index, 10_000))}</span></div><MiniChart values={data.market.indexHistory} positive={data.market.index >= 10_000} className="audience-chart" /></section>
    <section className="audience-side"><div className="audience-movers"><span className="eyebrow">TOP GAINERS</span>{movers.slice(0, 3).map((s) => <div key={s.ticker}><b>{s.ticker}</b><span className="positive">{pct(changePct(s.currentPrice, s.basePrice))}</span></div>)}</div><div className="audience-movers"><span className="eyebrow">TOP LOSERS</span>{movers.slice(-3).reverse().map((s) => <div key={s.ticker}><b>{s.ticker}</b><span className="negative">{pct(changePct(s.currentPrice, s.basePrice))}</span></div>)}</div></section></div>
    <div className="audience-lower"><section className="audience-stocks"><div className="audience-section-title"><h2>MARKET WATCH</h2><span>25 LISTED COMPANIES · SIMULATED PRICES</span></div><div className="audience-stock-grid">{data.market.stocks.map((s) => { const delta = changePct(s.currentPrice, s.basePrice); return <div key={s.ticker}><b>{s.ticker}</b><small>{s.name}</small><strong>{rupee(s.currentPrice, 2)}</strong><span className={delta >= 0 ? "positive" : "negative"}>{pct(delta)}</span></div>; })}</div></section>
      <aside className="audience-right"><section className="audience-leaderboard"><div className="audience-section-title"><h2>TOP PERFORMERS</h2><span>COMPLETED SESSIONS · RETURN %</span></div>{ranks.length ? ranks.map((p, i) => { const ret = ((p.session.endingValue || 0) / (p.session.startingValue || 1) - 1) * 100; return <div className="leader-row" key={p.id}><span>{String(i + 1).padStart(2, "0")}</span><b>{p.displayName}</b><strong className={ret >= 0 ? "positive" : "negative"}>{pct(ret)}</strong></div>; }) : <p className="leader-empty">The leaderboard appears after the first completed session.</p>}</section>
      <section className="audience-breaking"><div className="audience-section-title"><h2>MARKET NEWS</h2><span>LIVE UPDATES</span></div>{data.market.activeNews.slice(0, 3).map((n) => <div className="audience-news-row" key={n.id}><span>{new Date(n.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span><b>{n.headline}</b></div>)}{!data.market.activeNews.length && <p className="tiny-muted">Headlines from the market will appear here.</p>}</section></aside></div>
    <footer className="audience-footer"><span>SIMULATION PRICES · NOT LIVE MARKET DATA</span><span>PRATIBIMB · BUSINESS EDUCATION DEPARTMENT</span><span>MARKET MOOD · {data.market.mood.toUpperCase()}</span></footer>
  </main>;
}
