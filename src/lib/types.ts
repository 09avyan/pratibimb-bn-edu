export type Candle = { time: number; open: number; high: number; low: number; close: number };

export type Stock = {
  id: string;
  ticker: string;
  name: string;
  sector: string;
  basePrice: number;
  currentPrice: number;
  previousPrice: number;
  volume: number;
  history: number[];
  candles: Candle[];
  volatility: number;
  beta: number;
  momentum: number;
  personality: "defensive" | "momentum" | "cyclical" | "reverting";
};

export type NewsItem = {
  id: string;
  headline: string;
  category: string;
  targets: string[];
  direction: -1 | 1;
  strength: number;
  duration: number;
  createdAt: number;
  expiresAt: number;
};

export type MarketState = {
  running: boolean;
  tick: number;
  stocks: Stock[];
  index: number;
  previousIndex: number;
  indexHistory: number[];
  activeNews: NewsItem[];
  mood: string;
  lastUpdated: number;
  impacts: Record<string, number>;
};

export type Trade = {
  id: string;
  ticker: string;
  side: "BUY" | "SELL" | "SHORT" | "COVER";
  quantity: number;
  price: number;
  at: number;
  impact: number;
};

export type Position = { quantity: number; averagePrice: number };
export type PendingOrder = { id: string; ticker: string; side: "BUY" | "SELL"; quantity: number; limitPrice: number; createdAt: number };
export type Portfolio = { cash: number; positions: Record<string, Position>; orders: PendingOrder[]; trades: Trade[] };

export type Session = {
  status: "idle" | "trading" | "closing" | "paused" | "completed";
  startedAt?: number;
  tradingEndsAt?: number;
  closingEndsAt?: number;
  pausedSeconds?: number;
  pausedPhase?: "trading" | "closing";
  startingValue?: number;
  endingValue?: number;
  startingIndex?: number;
  endingIndex?: number;
  completedAt?: number;
};

export type Participant = {
  id: string;
  displayName: string;
  username: string;
  pin: string;
  createdAt: number;
  portfolio: Portfolio;
  session: Session;
};

export type DemoState = { market: MarketState; participants: Participant[] };
