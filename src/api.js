// Keyless data sources, all called from the user's browser. Nothing here needs or stores an API key.
export const PUMPPORTAL_WS = "wss://pumpportal.fun/api/data";
const n = (v) => (v == null || v === "" || isNaN(+v) ? null : +v);
async function get(url) { try { const r = await fetch(url, { cache: "no-store" }); return r.ok ? await r.json() : null; } catch { return null; } }

// PumpPortal new-token stream. Its create payload exposes `is_mayhem_mode` (boolean, mirrors the on-chain
// create_v2 arg / bonding-curve field per pump-fun/pump-public-docs). onToken gets only events where it is === true
// unless showAll. Also subscribes to trades for mayhem mints to keep market cap live.
export function streamMayhem({ onToken, onTrade, onStatus, showAll = () => false }) {
  let ws, stop = false, retry = 1000;
  const open = () => {
    onStatus?.("connecting");
    ws = new WebSocket(PUMPPORTAL_WS);
    ws.onopen = () => { retry = 1000; onStatus?.("live"); ws.send(JSON.stringify({ method: "subscribeNewToken" })); };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch { return; }
      if (m.txType === "create") {
        const mayhem = m.is_mayhem_mode === true ? true : m.is_mayhem_mode === false ? false : null; // null = field absent → unknown
        if (mayhem || showAll()) { onToken?.({ ...m, mayhem, seenAt: Date.now() }); if (mayhem) try { ws.send(JSON.stringify({ method: "subscribeTokenTrade", keys: [m.mint] })); } catch {} }
      } else if (m.txType === "buy" || m.txType === "sell") onTrade?.(m);
    };
    ws.onclose = () => { onStatus?.("reconnecting"); if (!stop) setTimeout(open, (retry = Math.min(retry * 2, 30000))); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  };
  open();
  return () => { stop = true; try { ws.close(); } catch {} };
}

export async function dexPairs(mints) {
  const out = {};
  for (let i = 0; i < mints.length; i += 30) {
    const j = await get("https://api.dexscreener.com/tokens/v1/solana/" + mints.slice(i, i + 30).join(","));
    for (const p of Array.isArray(j) ? j : []) {
      const m = p.baseToken?.address; if (!m) continue;
      const liq = n(p.liquidity?.usd);
      if (!out[m] || (liq || 0) > (out[m].liqUsd || 0)) out[m] = { priceUsd: n(p.priceUsd), liqUsd: liq, fdv: n(p.fdv), mcap: n(p.marketCap), vol24: n(p.volume?.h24), dex: p.dexId, url: p.url };
    }
  }
  return out;
}

export async function rugcheck(mint) {
  const d = await get(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`);
  if (!d) return null;
  const skip = new Set();
  for (const [a, v] of Object.entries(d.knownAccounts || {})) if (/AMM|LOCKER/i.test(v?.type || "")) skip.add(a);
  let lockedUsd = 0, totUsd = 0;
  for (const m of d.markets || []) { [m.pubkey, m.liquidityAAccount, m.liquidityBAccount].forEach((a) => typeof a === "string" && skip.add(a));
    const lp = m.lp || {}; const t = (n(lp.baseUSD) || 0) + (n(lp.quoteUSD) || 0); totUsd += t; lockedUsd += t * ((n(lp.lpLockedPct) || 0) / 100); }
  const holders = (d.topHolders || []).filter((h) => !skip.has(h.address) && !skip.has(h.owner));
  const supply = n(d.token?.supply), dec = n(d.token?.decimals);
  const devBal = n(d.creatorBalance);
  return {
    mintAuthority: "mintAuthority" in d ? d.mintAuthority : undefined, freezeAuthority: "freezeAuthority" in d ? d.freezeAuthority : undefined,
    lpLockedPct: totUsd > 0 ? (lockedUsd / totUsd) * 100 : null, rcLiqUsd: n(d.totalMarketLiquidity),
    top10Pct: (d.topHolders || []).length ? holders.slice(0, 10).reduce((a, h) => a + (n(h.pct) || 0), 0) : null,
    devPct: devBal != null && supply ? (devBal / supply) * 100 : null, // creatorBalance & supply both raw units in RugCheck reports (when present)
    supplyUi: supply != null && dec != null ? supply / 10 ** dec : null,
    holders: n(d.totalHolders), score: n(d.score_normalised), rugged: !!d.rugged, risks: (d.risks || []).map((r) => r.name),
  };
}

// Flags: each {t, cls:'bad'|'ok'|'unk'}. Unknown data is shown as unknown, never guessed.
export function flags(tok) {
  const f = [], rc = tok.rc, ds = tok.ds;
  f.push({ t: "MAYHEM", cls: "bad" });
  const age = (Date.now() - tok.seenAt) / 3600e3;
  f.push(age < 24 ? { t: "agent window <24h", cls: "bad" } : { t: "agent window over", cls: "unk" });
  if (!rc) f.push({ t: "RugCheck: unknown", cls: "unk" });
  else {
    f.push(rc.mintAuthority === undefined ? { t: "mint auth ?", cls: "unk" } : rc.mintAuthority ? { t: "mint authority ON", cls: "bad" } : { t: "mint auth revoked", cls: "ok" });
    f.push(rc.freezeAuthority === undefined ? { t: "freeze auth ?", cls: "unk" } : rc.freezeAuthority ? { t: "freeze authority ON", cls: "bad" } : { t: "no freeze auth", cls: "ok" });
    f.push(rc.top10Pct == null ? { t: "top10 ?", cls: "unk" } : { t: `top10 ${rc.top10Pct.toFixed(1)}%`, cls: rc.top10Pct > 30 ? "bad" : "ok" });
    f.push(rc.devPct == null ? { t: "dev hold ?", cls: "unk" } : { t: `dev ${rc.devPct.toFixed(1)}%`, cls: rc.devPct > 5 ? "bad" : "ok" });
    f.push(rc.lpLockedPct == null ? { t: "LP lock ?", cls: "unk" } : { t: `LP locked ${rc.lpLockedPct.toFixed(0)}%`, cls: rc.lpLockedPct < 90 ? "bad" : "ok" });
    if (rc.rugged) f.push({ t: "RUGGED", cls: "bad" });
    for (const r of rc.risks.slice(0, 4)) f.push({ t: r, cls: "bad" });
  }
  const liq = ds?.liqUsd ?? rc?.rcLiqUsd;
  f.push(liq == null ? { t: "liquidity ?", cls: "unk" } : { t: `liq $${Math.round(liq).toLocaleString()}`, cls: liq < 5000 ? "bad" : "ok" });
  return f;
}
