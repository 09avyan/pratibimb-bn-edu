import type { Candle, MarketState, NewsItem, Stock } from "./types";

type Seed = [string, string, string, number, number, Stock["personality"]];
export const STOCK_SEEDS: Seed[] = [
  ["RELIANCE", "Reliance Industries", "Energy", 1468, 1.12, "cyclical"],
  ["TCS", "Tata Consultancy Services", "IT", 3248, 0.83, "defensive"],
  ["INFY", "Infosys", "IT", 1512, 1.06, "momentum"],
  ["HDFCBANK", "HDFC Bank", "Banking", 1740, 0.94, "defensive"],
  ["ICICIBANK", "ICICI Bank", "Banking", 1268, 1.05, "momentum"],
  ["SBIN", "State Bank of India", "Banking", 812, 1.18, "cyclical"],
  ["BHARTIARTL", "Bharti Airtel", "Telecom", 1828, 0.92, "defensive"],
  ["ITC", "ITC", "Consumer", 438, 0.69, "defensive"],
  ["HINDUNILVR", "Hindustan Unilever", "Consumer", 2380, 0.72, "reverting"],
  ["MARUTI", "Maruti Suzuki", "Auto", 12640, 1.08, "cyclical"],
  ["TATAMOTORS", "Tata Motors", "Auto", 728, 1.34, "momentum"],
  ["SUNPHARMA", "Sun Pharma", "Pharma", 1814, 0.81, "defensive"],
  ["DRREDDY", "Dr. Reddy's Laboratories", "Pharma", 1298, 0.79, "reverting"],
  ["LT", "Larsen & Toubro", "Infrastructure", 3540, 1.07, "cyclical"],
  ["TATASTEEL", "Tata Steel", "Metals", 162, 1.42, "cyclical"],
  ["ASIANPAINT", "Asian Paints", "Consumer", 2480, 0.96, "reverting"],
  ["BAJFINANCE", "Bajaj Finance", "Finance", 912, 1.38, "momentum"],
  ["AXISBANK", "Axis Bank", "Banking", 1176, 1.13, "cyclical"],
  ["NTPC", "NTPC", "Energy", 342, 0.86, "defensive"],
  ["POWERGRID", "Power Grid Corporation", "Energy", 314, 0.74, "defensive"],
  ["ONGC", "Oil & Natural Gas Corp.", "Energy", 268, 1.16, "cyclical"],
  ["COALINDIA", "Coal India", "Metals", 428, 0.98, "cyclical"],
  ["TITAN", "Titan Company", "Consumer", 3480, 1.03, "momentum"],
  ["NESTLEIND", "Nestlé India", "Consumer", 2268, 0.7, "defensive"],
  ["M&M", "Mahindra & Mahindra", "Auto", 2862, 1.17, "momentum"],
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const random = (min: number, max: number) => Math.random() * (max - min) + min;
const roundPrice = (n: number) => Math.max(1, Math.round(n * 100) / 100);

function seedStock(seed: Seed, index: number): Stock {
  const [ticker, name, sector, price, beta, personality] = seed;
  const vol = personality === "defensive" ? 0.009 : personality === "momentum" ? 0.016 : personality === "cyclical" ? 0.014 : 0.011;
  const history: number[] = [];
  let p = price * (1 + random(-0.018, 0.018));
  for (let i = 0; i < 48; i++) {
    p = Math.max(price * 0.88, Math.min(price * 1.12, p * (1 + random(-0.004, 0.004))));
    history.push(roundPrice(p));
  }
  history[history.length - 1] = price;
  const candles: Candle[] = history.slice(-24).map((close, i, rows) => {
    const open = i === 0 ? close * (1 + random(-0.002, 0.002)) : rows[i - 1];
    return { time: Date.now() - (rows.length - i) * 15_000, open, close, high: Math.max(open, close) * (1 + random(0, 0.002)), low: Math.min(open, close) * (1 - random(0, 0.002)) };
  });
  return { id: ticker, ticker, name, sector, basePrice: price, currentPrice: price, previousPrice: price, volume: Math.round(random(45_000, 780_000)), history, candles, volatility: vol, beta, momentum: random(-0.001, 0.001), personality };
}

function calcIndex(stocks: Stock[]) {
  const basket = ["RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "LT", "ITC", "MARUTI", "SUNPHARMA"];
  const names = new Set(basket);
  const parts = stocks.filter((s) => names.has(s.ticker));
  return Math.round((parts.reduce((sum, s) => sum + s.currentPrice / s.basePrice, 0) / parts.length) * 10_000 * 100) / 100;
}

export function createInitialMarket(): MarketState {
  const stocks = STOCK_SEEDS.map(seedStock);
  const index = calcIndex(stocks);
  return { running: true, tick: 0, stocks, index, previousIndex: index, indexHistory: Array.from({ length: 48 }, (_, i) => 10_000 + Math.sin(i / 3) * 16 + random(-12, 12)), activeNews: [], mood: "Steady", lastUpdated: Date.now(), impacts: {} };
}

export const NEWS_LIBRARY: Array<Omit<NewsItem, "id" | "createdAt" | "expiresAt"> & { duration: number }> = [
  { headline: "RBI signals a measured approach to interest rates", category: "Policy", targets: ["Banking", "Finance"], direction: 1, strength: 1.4, duration: 65 },
  { headline: "A major global client expands its India technology contract", category: "Corporate", targets: ["IT"], direction: 1, strength: 1.8, duration: 70 },
  { headline: "Crude oil climbs as supply routes face fresh uncertainty", category: "Global markets", targets: ["Energy", "Auto"], direction: -1, strength: 1.7, duration: 60 },
  { headline: "Monsoon forecast improves across key farming regions", category: "Economy", targets: ["Consumer"], direction: 1, strength: 1.1, duration: 55 },
  { headline: "Drug regulator grants approval for a new treatment", category: "Corporate", targets: ["SUNPHARMA", "DRREDDY"], direction: 1, strength: 1.7, duration: 62 },
  { headline: "Steel demand rises after a new infrastructure package", category: "Policy", targets: ["Metals", "Infrastructure"], direction: 1, strength: 1.6, duration: 65 },
  { headline: "Automaker recalls vehicles after a supplier quality review", category: "Corporate", targets: ["TATAMOTORS", "M&M"], direction: -1, strength: 2, duration: 70 },
  { headline: "Rupee strengthens as foreign investment returns", category: "Currency", targets: ["IT", "Energy"], direction: 1, strength: 1, duration: 60 },
  { headline: "Quarterly results miss analyst expectations at a large lender", category: "Corporate", targets: ["SBIN", "AXISBANK"], direction: -1, strength: 1.7, duration: 65 },
  { headline: "New capacity set to improve clean power generation", category: "Corporate", targets: ["NTPC", "POWERGRID"], direction: 1, strength: 1.3, duration: 62 },
  { headline: "Consumer spending remains resilient in recent surveys", category: "Economy", targets: ["Consumer"], direction: 1, strength: 1.3, duration: 70 },
  { headline: "Global investors turn cautious ahead of key economic data", category: "Global markets", targets: ["MARKET"], direction: -1, strength: 1.4, duration: 65 },
];

export function releaseNews(market: MarketState, template: (typeof NEWS_LIBRARY)[number], now = Date.now()): MarketState {
  const news: NewsItem = { ...template, id: crypto.randomUUID(), createdAt: now, expiresAt: now + template.duration * 1000 };
  return { ...market, activeNews: [news, ...market.activeNews].slice(0, 12), lastUpdated: now };
}

export function tickMarket(market: MarketState, now = Date.now()): MarketState {
  if (!market.running) return market;
  const activeNews = market.activeNews.filter((item) => item.expiresAt > now);
  const sectors = [...new Set(market.stocks.map((s) => s.sector))];
  const sectorFlows: Record<string, number> = {};
  for (const sector of sectors) sectorFlows[sector] = random(-0.0008, 0.0008);
  const marketFlow = random(-0.00105, 0.00105);
  const stocks = market.stocks.map((stock) => {
    const newsPressure = activeNews.reduce((sum, item) => {
      const targeted = item.targets.includes("MARKET") || item.targets.includes(stock.ticker) || item.targets.includes(stock.sector);
      if (!targeted) return sum;
      const age = (now - item.createdAt) / (item.duration * 1000);
      return sum + item.direction * item.strength * 0.00013 * Math.max(0.15, 1 - age);
    }, 0);
    const revert = stock.personality === "reverting" ? ((stock.basePrice - stock.currentPrice) / stock.basePrice) * 0.00065 : 0;
    const trend = stock.personality === "momentum" ? stock.momentum * 0.32 : stock.momentum * 0.12;
    const noise = random(-stock.volatility, stock.volatility) * 0.09;
    const impact = (market.impacts[stock.ticker] || 0) * 0.18;
    // Thirty-six tiny rule-based bot signals: news chasers, momentum/crowd traders,
    // market makers, value buyers and noisy retail flow. No API or persistent bot books.
    let botFlow = 0;
    for (let bot = 0; bot < 36; bot++) {
      const kind = bot % 6;
      const signal = kind === 0 ? newsPressure * random(0.7, 1.35)
        : kind === 1 ? trend * random(0.6, 1.25)
          : kind === 2 ? marketFlow * random(0.4, 1.1)
            : kind === 3 ? revert * random(0.5, 1.15)
              : kind === 4 ? (Math.sign(newsPressure || trend || marketFlow) * Math.max(Math.abs(newsPressure), Math.abs(trend)) * 0.28)
                : random(-0.00028, 0.00028);
      botFlow += signal;
    }
    botFlow = clamp((botFlow / 36) * 1.8, -0.001, 0.001);
    const change = clamp(marketFlow * stock.beta + (sectorFlows[stock.sector] || 0) * 0.6 + newsPressure + revert + trend + botFlow + noise + impact, -0.012, 0.012);
    const close = roundPrice(stock.currentPrice * (1 + change));
    const candle: Candle = { time: now, open: stock.currentPrice, close, high: roundPrice(Math.max(stock.currentPrice, close) * (1 + random(0, 0.0011))), low: roundPrice(Math.min(stock.currentPrice, close) * (1 - random(0, 0.0011))) };
    const history = [...stock.history, close].slice(-72);
    return { ...stock, previousPrice: stock.currentPrice, currentPrice: close, volume: stock.volume + Math.round(random(120, 2400)), history, candles: [...stock.candles, candle].slice(-48), momentum: clamp(stock.momentum * 0.75 + change * 0.22, -0.004, 0.004) };
  });
  const index = calcIndex(stocks);
  const dayMove = (index - 10_000) / 10_000;
  return { ...market, stocks, previousIndex: market.index, index, indexHistory: [...market.indexHistory, index].slice(-72), activeNews, tick: market.tick + 1, lastUpdated: now, impacts: Object.fromEntries(Object.entries(market.impacts).map(([ticker, value]) => [ticker, value * 0.68]).filter(([, value]) => Math.abs(value as number) > 0.00002)), mood: dayMove > 0.012 ? "Optimistic" : dayMove < -0.012 ? "Cautious" : "Steady" };
}

export function findStock(market: MarketState, ticker: string) { return market.stocks.find((stock) => stock.ticker === ticker); }
