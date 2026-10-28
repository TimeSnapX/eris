// Paper portfolio in localStorage "eris.v1". Simulated only: no transaction is ever built or sent.
const KEY = "eris.v1";
const fresh = () => ({ v: 1, cash: 1000, start: 1000, pos: {}, log: [] });
export function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.v === 1 ? s : fresh(); } catch { return fresh(); } }
export function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
export function reset() { const s = fresh(); save(s); return s; }
export function buy(s, mint, sym, usd, price) {
  if (!(price > 0)) throw new Error("No live USD price for this coin yet (DexScreener has no pair): can't paper-trade it.");
  if (!(usd > 0) || usd > s.cash) throw new Error("Not enough paper cash.");
  const qty = usd / price, p = s.pos[mint] || { sym, qty: 0, cost: 0 };
  p.qty += qty; p.cost += usd; s.pos[mint] = p; s.cash -= usd; s.log.unshift({ t: Date.now(), side: "BUY", mint, sym, usd, price }); save(s); return s;
}
export function sell(s, mint, price) {
  const p = s.pos[mint]; if (!p) return s;
  if (!(price > 0)) throw new Error("No live USD price: can't value this sell.");
  const usd = p.qty * price; s.cash += usd; delete s.pos[mint]; s.log.unshift({ t: Date.now(), side: "SELL", mint, sym: p.sym, usd, price, pnl: usd - p.cost }); save(s); return s;
}
