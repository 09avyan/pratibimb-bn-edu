import { createInitialMarket, findStock, releaseNews, tickMarket } from "./market";
import type { DemoState, MarketState, Participant, PendingOrder, Portfolio, Session, Trade } from "./types";

const STORAGE_KEY = "pratibimb.demo.v1";
const CHANNEL_NAME = "pratibimb-demo-v1";
const STARTING_CASH = 1_000_000;
const noop = () => {};

export interface DemoRepository {
  load(): DemoState;
  save(state: DemoState): void;
  subscribe(listener: () => void): () => void;
}

export class BrowserDemoRepository implements DemoRepository {
  private channel?: BroadcastChannel;
  private listeners = new Set<() => void>();
  private initialized = false;
  private current: DemoState = { market: createInitialMarket(), participants: [] };

  load() {
    if (typeof window === "undefined") return this.current;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) this.current = normalizeState(JSON.parse(saved));
    } catch { /* a damaged local demo cache starts a fresh simulation */ }
    return this.current;
  }

  save(state: DemoState) {
    this.current = state;
    if (typeof window !== "undefined") {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* keep the live in-memory session */ }
      this.channel?.postMessage({ type: "snapshot", state });
    }
    this.listeners.forEach((listener) => listener());
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    if (typeof window !== "undefined" && !this.initialized) {
      this.initialized = true;
      if ("BroadcastChannel" in window) {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data?.type !== "snapshot") return;
          this.current = normalizeState(event.data.state);
          this.listeners.forEach((update) => update());
        };
      }
      window.addEventListener("storage", (event) => {
        if (event.key !== STORAGE_KEY || !event.newValue) return;
        try { this.current = normalizeState(JSON.parse(event.newValue)); this.listeners.forEach((update) => update()); } catch { /* ignore malformed storage events */ }
      });
    }
    return () => this.listeners.delete(listener);
  }
}

function normalizeState(value: DemoState): DemoState {
  const fresh = createInitialMarket();
  if (!value || !value.market || !Array.isArray(value.participants)) return { market: fresh, participants: [] };
  const stockByTicker = new Map((value.market.stocks || []).map((stock) => [stock.ticker, stock]));
  const stocks = fresh.stocks.map((stock) => ({ ...stock, ...(stockByTicker.get(stock.ticker) || {}) }));
  return { market: { ...fresh, ...value.market, stocks }, participants: value.participants };
}

class DemoStore {
  private repo: DemoRepository = new BrowserDemoRepository();
  private state: DemoState = this.repo.load();
  private listeners = new Set<() => void>();

  start() {
    this.state = this.repo.load();
    this.repo.subscribe(() => { this.state = this.repo.load(); this.listeners.forEach((listener) => listener()); });
    this.listeners.forEach((listener) => listener());
  }

  getState = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  private update(fn: (state: DemoState) => DemoState) { this.state = fn(this.state); this.repo.save(this.state); }

  setRunning(running: boolean) { this.update((s) => ({ ...s, market: { ...s.market, running, lastUpdated: Date.now() } })); }
  publishNews(template: Parameters<typeof releaseNews>[1]) { this.update((s) => ({ ...s, market: releaseNews(s.market, template) })); }
  setImpact(ticker: string, amount: number) { this.update((s) => ({ ...s, market: { ...s.market, impacts: { ...s.market.impacts, [ticker]: (s.market.impacts[ticker] || 0) + amount } } })); }

  advanceMarket() {
    const now = Date.now();
    let market = tickMarket(this.state.market, now);
    if (market === this.state.market) { this.advanceSessions(now); return; }
    let participants = this.state.participants.map((person) => {
      let next = this.advancePerson(person, now);
      const orders: PendingOrder[] = [];
      for (const order of next.portfolio.orders) {
        if (next.session.status !== "trading" && !(next.session.status === "closing" && order.side === "SELL")) { orders.push(order); continue; }
        const quote = findStock(market, order.ticker)?.currentPrice;
        const fill = quote !== undefined && (order.side === "BUY" ? quote <= order.limitPrice : quote >= order.limitPrice);
        if (!fill) { orders.push(order); continue; }
        try {
          const filled = executeOrder(next, order.side, order.ticker, order.quantity, quote, "MARKET", market, now);
          next = filled.person;
        } catch { /* expire a triggered order that no longer passes account checks */ }
      }
      return { ...next, portfolio: { ...next.portfolio, orders } };
    });
    this.state = { ...this.state, market, participants };
    this.repo.save(this.state);
  }

  advanceSessionsOnly() { this.advanceSessions(Date.now()); }

  private advanceSessions(now: number) {
    const participants = this.state.participants.map((p) => this.advancePerson(p, now));
    if (participants.some((p, i) => p !== this.state.participants[i])) this.update((s) => ({ ...s, participants }));
  }

  private advancePerson(person: Participant, now: number): Participant {
    const session = person.session;
    if (session.status === "trading" && (session.tradingEndsAt || 0) <= now) {
      return { ...person, session: { ...session, status: "closing", closingEndsAt: (session.tradingEndsAt || now) + 60_000 } };
    }
    if (session.status === "closing" && (session.closingEndsAt || 0) <= now) return this.finish(person, now);
    return person;
  }

  register(displayName: string, username: string, pin: string) {
    const clean = username.trim().toLowerCase();
    if (!clean || this.state.participants.some((p) => p.username === clean)) throw new Error("That username is taken. Try the suggested option.");
    if (!displayName.trim() || !/^\d{4,6}$/.test(pin)) throw new Error("Enter your name and a 4–6 digit PIN.");
    const participant: Participant = { id: crypto.randomUUID(), displayName: displayName.trim(), username: clean, pin, createdAt: Date.now(), portfolio: emptyPortfolio(), session: { status: "idle" } };
    this.update((s) => ({ ...s, participants: [...s.participants, participant] }));
    return participant;
  }

  login(username: string, pin: string) {
    const found = this.state.participants.find((p) => p.username === username.trim().toLowerCase() && p.pin === pin);
    if (!found) throw new Error("Username or PIN doesn’t match.");
    return found;
  }

  startSession(id: string) {
    const now = Date.now();
    this.update((s) => ({ ...s, participants: s.participants.map((p) => p.id !== id || p.session.status !== "idle" ? p : { ...p, session: { status: "trading", startedAt: now, tradingEndsAt: now + 600_000, startingValue: portfolioValue(p.portfolio, s.market), startingIndex: s.market.index } }) }));
  }

  pauseSession(id: string) {
    const now = Date.now();
    this.update((s) => ({ ...s, participants: s.participants.map((p) => {
      if (p.id !== id) return p;
      if (p.session.status === "trading") return { ...p, session: { ...p.session, status: "paused", pausedPhase: "trading", pausedSeconds: Math.max(0, Math.ceil(((p.session.tradingEndsAt || now) - now) / 1000)) } };
      if (p.session.status === "closing") return { ...p, session: { ...p.session, status: "paused", pausedPhase: "closing", pausedSeconds: Math.max(0, Math.ceil(((p.session.closingEndsAt || now) - now) / 1000)) } };
      if (p.session.status === "paused") {
        const seconds = p.session.pausedSeconds || 0;
        return { ...p, session: p.session.pausedPhase === "closing" ? { ...p.session, status: "closing", closingEndsAt: now + seconds * 1000 } : { ...p.session, status: "trading", tradingEndsAt: now + seconds * 1000 } };
      }
      return p;
    }) }));
  }

  finishSession(id: string) {
    this.update((s) => ({ ...s, participants: s.participants.map((p) => p.id === id ? this.finish(p, Date.now()) : p) }));
  }

  resetPin(id: string) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    this.update((s) => ({ ...s, participants: s.participants.map((p) => p.id === id ? { ...p, pin } : p) }));
    return pin;
  }

  private finish(person: Participant, now: number): Participant {
    const portfolio = { ...person.portfolio, orders: [] };
    return { ...person, portfolio, session: { ...person.session, status: "completed", completedAt: now, endingValue: portfolioValue(portfolio, this.state.market), endingIndex: this.state.market.index } };
  }

  execute(id: string, side: "BUY" | "SELL" | "SHORT", ticker: string, quantity: number, orderType: "MARKET" | "LIMIT", limitPrice?: number, impactScale = 1) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100_000) throw new Error("Enter a whole number of shares (1–100,000).");
    const person = this.state.participants.find((p) => p.id === id);
    if (!person) throw new Error("Sign in to continue.");
    const phase = sessionPhase(person.session);
    if (person.session.status === "paused" || person.session.status === "completed" || person.session.status === "idle") throw new Error("Start or resume your session to trade.");
    const openPosition = person.portfolio.positions[ticker]?.quantity || 0;
    const isFullShortCover = side === "BUY" && openPosition < 0 && quantity <= Math.abs(openPosition);
    if (phase === "closing" && side !== "SELL" && !isFullShortCover) throw new Error("The Closing Window allows selling, covering shorts and cancelling orders.");
    const stock = findStock(this.state.market, ticker);
    if (!stock) throw new Error("That stock is no longer available.");
    if (orderType === "LIMIT") {
      if (side === "SHORT") throw new Error("Limit orders are available for long buys and sells. Use a market order to short.");
      if (phase !== "trading") throw new Error("New limit orders close when the Closing Window begins.");
      if (!limitPrice || !Number.isFinite(limitPrice) || limitPrice <= 0) throw new Error("Enter a valid limit price.");
      if (side === "SELL" && (person.portfolio.positions[ticker]?.quantity || 0) < quantity) throw new Error("You don’t hold enough shares to sell.");
      const order: PendingOrder = { id: crypto.randomUUID(), ticker, side, quantity, limitPrice, createdAt: Date.now() };
      this.update((s) => ({ ...s, participants: s.participants.map((p) => p.id === id ? { ...p, portfolio: { ...p.portfolio, orders: [...p.portfolio.orders, order] } } : p) }));
      return { pending: true };
    }
    const { person: updated, trade } = executeOrder(person, side, ticker, quantity, stock.currentPrice, "MARKET", this.state.market, Date.now());
    if (trade) {
      const impact = trade.impact * impactScale;
      this.update((s) => ({ ...s, market: { ...s.market, impacts: { ...s.market.impacts, [ticker]: (s.market.impacts[ticker] || 0) + impact } }, participants: s.participants.map((p) => p.id === id ? updated : p) }));
    }
    return { pending: false };
  }

  cancelOrder(id: string, orderId: string) {
    this.update((s) => ({ ...s, participants: s.participants.map((p) => p.id === id ? { ...p, portfolio: { ...p.portfolio, orders: p.portfolio.orders.filter((order) => order.id !== orderId) } } : p) }));
  }
}

function emptyPortfolio(): Portfolio { return { cash: STARTING_CASH, positions: {}, orders: [], trades: [] }; }

function executeOrder(person: Participant, side: "BUY" | "SELL" | "SHORT", ticker: string, quantity: number, quote: number, orderType: "MARKET", market: MarketState, now: number) {
  const stock = findStock(market, ticker);
  if (!stock) throw new Error("Stock not found.");
  const portfolio = person.portfolio;
  const position = portfolio.positions[ticker] || { quantity: 0, averagePrice: 0 };
  const sizeRatio = quantity / Math.max(10_000, stock.volume);
  const slip = Math.min(0.008, 0.00045 + sizeRatio * 0.018);
  let action: Trade["side"] = side;
  let price = quote;
  let nextQuantity = position.quantity;
  let cash = portfolio.cash;
  if (side === "BUY") {
    if (position.quantity < 0) {
      action = "COVER";
      price = quote * (1 + slip);
      const cover = Math.min(quantity, Math.abs(position.quantity));
      const cost = cover * price;
      if (cost > cash) throw new Error("Not enough cash to cover this short position.");
      cash -= cost;
      nextQuantity += cover;
      if (quantity > cover) {
        const rest = quantity - cover;
        const restCost = rest * price;
        if (restCost > cash) throw new Error("Not enough cash for this order.");
        cash -= restCost;
        nextQuantity += rest;
      }
    } else {
      price = quote * (1 + slip);
      const cost = quantity * price;
      if (cost > cash) throw new Error("Not enough available cash for this order.");
      cash -= cost;
      nextQuantity += quantity;
    }
  } else if (side === "SELL") {
    if (position.quantity < quantity) throw new Error("You don’t hold enough shares to sell.");
    price = quote * (1 - slip);
    cash += quantity * price;
    nextQuantity -= quantity;
  } else {
    const currentValue = portfolioValue(portfolio, market);
    const shortValue = Object.entries(portfolio.positions).reduce((sum, [symbol, pos]) => sum + Math.max(0, -pos.quantity) * (findStock(market, symbol)?.currentPrice || 0), 0);
    if (quantity * quote + shortValue > Math.max(STARTING_CASH, currentValue) * 0.5) throw new Error("Short exposure is limited to 50% of your portfolio value.");
    price = quote * (1 - slip);
    cash += quantity * price;
    nextQuantity -= quantity;
  }
  const averagePrice = nextQuantity === 0 ? 0 : position.quantity === 0 || Math.sign(position.quantity) !== Math.sign(nextQuantity) ? price : Math.abs(nextQuantity) > Math.abs(position.quantity) ? (Math.abs(position.quantity) * position.averagePrice + Math.abs(nextQuantity - position.quantity) * price) / Math.abs(nextQuantity) : position.averagePrice;
  const trade: Trade = { id: crypto.randomUUID(), ticker, side: action, quantity, price, at: now, impact: Math.min(0.00028, sizeRatio * 0.025) * (side === "SELL" || side === "SHORT" ? -1 : 1) };
  const nextPortfolio = { ...portfolio, cash, positions: { ...portfolio.positions, [ticker]: { quantity: nextQuantity, averagePrice } }, trades: [trade, ...portfolio.trades].slice(0, 250) };
  return { person: { ...person, portfolio: nextPortfolio }, trade };
}

export function portfolioValue(portfolio: Portfolio, market: MarketState) {
  return portfolio.cash + Object.entries(portfolio.positions).reduce((sum, [ticker, pos]) => sum + pos.quantity * (findStock(market, ticker)?.currentPrice || 0), 0);
}

export function sessionPhase(session: Session): "trading" | "closing" | "paused" | "completed" | "idle" {
  if (session.status === "trading" && (session.tradingEndsAt || 0) <= Date.now()) return "closing";
  if (session.status === "closing" && (session.closingEndsAt || 0) <= Date.now()) return "completed";
  return session.status;
}

export function secondsLeft(session: Session) {
  if (session.status === "paused") return session.pausedSeconds || 0;
  const until = session.status === "closing" ? session.closingEndsAt : session.tradingEndsAt;
  return Math.max(0, Math.ceil(((until || Date.now()) - Date.now()) / 1000));
}

export const store = new DemoStore();
export const startMarketLoop = (isAdmin = false) => {
  if (typeof window === "undefined") return noop;
  store.start();
  const tabId = crypto.randomUUID();
  const leaseKey = "pratibimb.market.lease";
  const beat = () => {
    if (!store.getState().market.running) { store.advanceMarket(); return; }
    try {
      const raw = window.localStorage.getItem(leaseKey);
      const lease = raw ? JSON.parse(raw) as { id: string; expires: number; admin?: boolean } : undefined;
      const now = Date.now();
      if (isAdmin || !lease || lease.expires < now || lease.id === tabId) {
        window.localStorage.setItem(leaseKey, JSON.stringify({ id: tabId, expires: now + 4500, admin: isAdmin }));
        store.advanceMarket();
      }
    } catch { store.advanceMarket(); }
  };
  const marketTimer = window.setInterval(beat, 1500);
  const sessionTimer = window.setInterval(() => store.advanceSessionsOnly(), 1000);
  beat();
  return () => { window.clearInterval(marketTimer); window.clearInterval(sessionTimer); };
};
