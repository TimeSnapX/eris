// Read-only Phantom badge. Uses only the injected provider (window.phantom.solana). Eris never requests a
// signature, never builds a transaction, never sees a seed phrase or key.
export const RPC = "https://solana-rpc.publicnode.com";
export const provider = () => { const p = window.phantom?.solana || (window.solana?.isPhantom ? window.solana : null); return p && typeof p.connect === "function" ? p : null; };
export const phantomBrowseLink = (url = location.href) => `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(url)}`;
const pk = (k) => (k ? (typeof k === "string" ? k : k.toBase58 ? k.toBase58() : String(k)) : null);
export async function detect() {
  for (let t = 0; t < 1500 && !provider(); t += 100) await new Promise((r) => setTimeout(r, 100));
  const p = provider(); if (!p) return null;
  if (p.publicKey) return pk(p.publicKey);
  try { const r = await p.connect({ onlyIfTrusted: true }); return pk(r?.publicKey || p.publicKey); } catch { return null; }
}
export async function connect() { const p = provider(); if (!p) throw new Error("No Phantom provider here. Use 'Open in Phantom'."); const r = await p.connect(); return pk(r?.publicKey || p.publicKey); }
export async function solBalance(addr) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr] }) });
  const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result.value / 1e9;
}
