import { streamMayhem, dexPairs, rugcheck, flags } from "./api.js";
import * as P from "./portfolio.js";
import * as W from "./wallet.js";
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const toast = (m) => { const d = document.createElement("div"); d.className = "toast"; d.textContent = m; $("#toasts").append(d); setTimeout(() => d.remove(), 4000); };
const fmt = (v, d = 2) => (v == null ? "unknown" : "$" + (+v).toLocaleString(undefined, { maximumFractionDigits: d }));
const tokens = new Map(); // mint -> token (session memory only; not persisted)
let tab = "feed", port = P.load(), wsStatus = "…";
const rcQueue = [];

function render() {
  $("#status").textContent = `Feed ${wsStatus} · ${tokens.size} mayhem coins this session`;
  const m = $("#main");
  if (tab === "feed") {
    if (!tokens.size) { m.innerHTML = `<div class="card mut">Waiting for new Mayhem Mode coins from PumpPortal… (only coins whose create event has <code>is_mayhem_mode: true</code> are shown)</div>`; return; }
    m.innerHTML = [...tokens.values()].sort((a, b) => b.seenAt - a.seenAt).slice(0, 60).map((t) => {
      const price = t.ds?.priceUsd;
      return `<div class="card"><div class="row"><b>${esc(t.name)} <span class="mut">$${esc(t.symbol)}</span></b><span class="mut">${new Date(t.seenAt).toLocaleTimeString()}</span></div>
      <div class="mut">${esc(t.mint)}</div>
      <div class="row mut"><span>MC ${t.marketCapSol != null ? (+t.marketCapSol).toFixed(1) + " SOL" : "unknown"}</span><span>Price ${price != null ? "$" + price.toPrecision(3) : "unknown"}</span><span>Holders ${t.rc?.holders ?? "unknown"}</span><span>RugCheck ${t.rc?.score ?? "unknown"}</span></div>
      <div class="flags">${flags(t).map((f) => `<span class="f ${f.cls}">${esc(f.t)}</span>`).join("")}</div>
      <div class="row"><span><a href="https://pump.fun/coin/${esc(t.mint)}" target="_blank" rel="noopener">pump.fun</a> · <a href="https://dexscreener.com/solana/${esc(t.mint)}" target="_blank" rel="noopener">DexScreener</a> · <a href="https://rugcheck.xyz/tokens/${esc(t.mint)}" target="_blank" rel="noopener">RugCheck</a></span>
      <span><input type="number" min="1" value="25" data-amt="${esc(t.mint)}"> <button class="btn small" data-buy="${esc(t.mint)}">Paper buy</button></span></div></div>`;
    }).join("");
  } else if (tab === "portfolio") {
    const rows = Object.entries(port.pos).map(([mint, p]) => { const px = tokens.get(mint)?.ds?.priceUsd ?? p.last; const val = px ? p.qty * px : null;
      return `<tr><td>${esc(p.sym)}</td><td>${fmt(p.cost)}</td><td>${fmt(val)}</td><td>${val == null ? "unknown" : fmt(val - p.cost)}</td><td><button class="btn small" data-sell="${esc(mint)}">Sell</button></td></tr>`; }).join("");
    const eq = port.cash + Object.entries(port.pos).reduce((a, [m, p]) => a + p.qty * (tokens.get(m)?.ds?.priceUsd ?? p.last ?? 0), 0);
    m.innerHTML = `<div class="card row"><span>Cash <b>${fmt(port.cash)}</b></span><span>Equity <b>${fmt(eq)}</b></span><span>P/L <b>${fmt(eq - port.start)}</b></span><button class="btn small ghost" id="reset">Reset to $1,000</button></div>
    <div class="card"><table><tr><th>Coin</th><th>Cost</th><th>Value</th><th>P/L</th><th></th></tr>${rows || `<tr><td colspan=5 class="mut">No positions</td></tr>`}</table></div>
    <div class="card"><b>History</b><table>${port.log.slice(0, 50).map((l) => `<tr><td>${new Date(l.t).toLocaleString()}</td><td>${l.side}</td><td>${esc(l.sym)}</td><td>${fmt(l.usd)}</td><td>${l.pnl != null ? fmt(l.pnl) : ""}</td></tr>`).join("")}</table><p class="mut">Simulated only, stored in this browser (localStorage <code>eris.v1</code>). Prices: DexScreener priceUsd. Ignores fees and slippage.</p></div>`;
  } else {
    m.innerHTML = `<div class="card"><b>What is Mayhem Mode?</b><p>An opt-in setting chosen at coin creation on pump.fun. Pump's agent gets an extra 1B tokens (2B total supply) and buys/sells at random for up to 24h, then burns whatever it didn't sell. Trade sizes and frequency are capped; it may not trade every coin. Sources: <a href="https://pump.fun/docs/mayhem-mode" target="_blank" rel="noopener">pump.fun/docs/mayhem-mode</a>, <a href="https://pump.fun/docs/mayhem-mode-disclaimer" target="_blank" rel="noopener">disclaimer</a>.</p>
    <p class="mut">Eris is read-only: it never builds, signs, or sends transactions. To trade for real, open the coin on pump.fun and sign there in Phantom yourself.</p></div>`;
  }
}

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab) { tab = b.dataset.tab; document.querySelectorAll("nav button").forEach((x) => x.classList.toggle("on", x === b)); render(); }
  else if (b.dataset.buy) { const t = tokens.get(b.dataset.buy); const amt = +document.querySelector(`[data-amt="${CSS.escape(b.dataset.buy)}"]`).value;
    try { port = P.buy(port, t.mint, t.symbol, amt, t.ds?.priceUsd); port.pos[t.mint].last = t.ds.priceUsd; P.save(port); toast(`Paper bought ${fmt(amt)} of ${t.symbol}`); } catch (er) { toast(er.message); } render(); }
  else if (b.dataset.sell) { const mint = b.dataset.sell; const px = tokens.get(mint)?.ds?.priceUsd ?? (await dexPairs([mint]))[mint]?.priceUsd;
    try { port = P.sell(port, mint, px); toast("Paper sold"); } catch (er) { toast(er.message); } render(); }
  else if (b.id === "reset" && confirm("Reset paper portfolio to $1,000?")) { port = P.reset(); render(); }
  else if (b.id === "connect") { try { showWallet(await W.connect()); } catch (er) { toast(er.message); } }
});

async function showWallet(addr) {
  const el = $("#walletBadge");
  if (!addr) { el.innerHTML = W.provider() ? `<button class="btn small" id="connect">Connect Phantom (read-only)</button>` : "Wallet: none (use Open in Phantom)"; return; }
  el.textContent = `👻 ${addr.slice(0, 4)}…${addr.slice(-4)} · … SOL`; el.title = addr;
  try { el.textContent = `👻 ${addr.slice(0, 4)}…${addr.slice(-4)} · ${(await W.solBalance(addr)).toFixed(3)} SOL`; } catch { el.textContent = `👻 ${addr.slice(0, 4)}…${addr.slice(-4)} · balance unknown`; }
}

// Enrichment loops: DexScreener prices every 30s; RugCheck one coin every 3s (rate-limit friendly, retried once later).
setInterval(async () => { const ms = [...tokens.keys()].slice(-90); if (!ms.length) return; const d = await dexPairs(ms); for (const [m, v] of Object.entries(d)) { const t = tokens.get(m); if (t) t.ds = v; if (port.pos[m] && v.priceUsd) port.pos[m].last = v.priceUsd; } P.save(port); render(); }, 30000);
setInterval(async () => { const t = rcQueue.shift(); if (!t) return; if (Date.now() - t.seenAt < 20000) { rcQueue.push(t); return; } const r = await rugcheck(t.mint); if (r) t.rc = r; else if (!t.rcTried) { t.rcTried = 1; rcQueue.push(t); } render(); }, 3000);

streamMayhem({
  onStatus: (s) => { wsStatus = s; render(); },
  onToken: (t) => { if (!t.mayhem) return; tokens.set(t.mint, t); rcQueue.push(t); if (tokens.size > 200) tokens.delete(tokens.keys().next().value); render(); },
  onTrade: (m) => { const t = tokens.get(m.mint); if (t && m.marketCapSol != null) { t.marketCapSol = m.marketCapSol; t.trades = (t.trades || 0) + 1; } },
});
$("#openPhantom").href = W.phantomBrowseLink(location.href);
W.detect().then(showWallet);
setInterval(render, 15000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js", { scope: "/eris/" }).catch((e) => console.warn("SW", e));
render();
