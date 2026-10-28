# How pump.fun Mayhem Mode works (research notes, 2026-10-28)

Sources are pump.fun official pages and the official `pump-fun` GitHub org, plus one live PumpPortal observation. Anything not stated there is marked **UNKNOWN**.

## Official sources
1. pump.fun docs, Mayhem Mode: https://pump.fun/docs/mayhem-mode
2. pump.fun docs, Mayhem Mode Disclaimer: https://pump.fun/docs/mayhem-mode-disclaimer
3. pump.fun Mayhem page (agent states, Auto/Manual): https://pump.fun/mayhem
4. pump-fun/pump-public-docs README (create_v2, `is_mayhem_mode`, Mayhem program accounts): https://github.com/pump-fun/pump-public-docs (see README at commit 1059c0d9: https://github.com/pump-fun/pump-public-docs/blob/1059c0d9/README.md)
5. pump-fun/pump-public-docs COIN_CREATION.md: https://github.com/pump-fun/pump-public-docs/blob/main/docs/instructions/COIN_CREATION.md

## Mechanics (as stated by pump.fun)
- **Opt-in at creation only.** The creator turns Mayhem Mode on when creating a bonding-curve coin and can't turn it on later. The agent never trades coins that didn't opt in. [1]
- **Doubled supply.** The agent mints an extra 1,000,000,000 tokens, so supply is 2B. 1B goes to the bonding curve as normal, and 1B goes to the trading agent/bot. [1][2]
- **Same start.** The starting market cap and initial liquidity are exactly the same as a regular pump.fun coin. [1]
- **Random trading for 24h.** The agent buys and sells "with equal probabilities in a random walk" during the first 24h [1]. The disclaimer adds that the buy/sell bias can be "slightly higher or lower" and is set "on a discretionary basis" across all Mayhem coins, so it may not be exactly neutral [2].
- **Not guaranteed.** The agent may not trade every Mayhem coin. It picks coins at random and runs on a fixed maximum number of coins at once. [1][2]
- **Limits.** At most 1 trade per second per coin, and each trade is capped at a fixed SOL amount (the exact value is **UNKNOWN**, not published). Trades may respond to slippage. [2]
- **When it stops.** It stops when a set time has passed (24h per [1]) or when the bot has made more than a set number of trades (that number is **UNKNOWN**). It is never reactivated for the same coin. [2]
- **Burn.** When it stops, any agent-held tokens are burned. Tokens sent to the agent wallet for an eligible coin inside its 24h window are also burned. Tokens sent for ineligible or expired coins sit in the agent wallet forever. [1]
- **Liquidity risk.** If the agent ends up a net seller, some holders may be unable to sell into the bonding curve. Once a coin migrates to PumpSwap, holders can always sell for SOL. [1]
- **Fees.** Bot trades pay no Pump Platform fees. [2]
- **Permanent tag.** Mayhem coins keep the Mayhem tag even after the mode ends. You can check it on the pump.fun web app, the mobile app, or Terminal. [1][2]
- **Agent states and modes (newer pump.fun/mayhem page).** The states are "Agent active", "Agent paused" (liquidity or market cap too low, so top up or relaunch), and "Agent ended". In **Auto** mode it trades on its own with a "self-exciting trade cadence" (more trading leads to more agent activity) for 24h while liquidity allows. In **Manual** mode it trades only when the coin creator prompts it, with direction and size still random. [3] How these modes relate to the older 50/50 random-walk wording in [1] is **UNKNOWN**, and the page shows untranslated i18n keys, so it may be a work in progress.

## On-chain / API detection
- The coin is created with `create_v2` (Token-2022), which has a required bool arg `is_mayhem_mode`. The `BondingCurve` (82 bytes) and PumpSwap `Pool` (244 bytes) accounts also carry an `is_mayhem_mode` field. Coins made with the legacy `create` instruction are always `false`. [4][5]
- The Mayhem program is `MAyhSmzXzV1pTf7LsNkrNwkWKTo4ougAJ1PPg47MD4e`. Its accounts include global_params `13ec7XdrjF3h3YcqBTFDSReRcUFwbCnJaAQspM4j6DDJ`, sol_vault `BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s`, and a per-mint `mayhem-state` PDA. [4][5]
- Mayhem coins use a separate Mayhem fee recipient for buys and sells. [4]
- **PumpPortal (third party, not pump.fun official).** I checked this live on 2026-10-28: `subscribeNewToken` create events on `wss://pumpportal.fun/api/data` include `"is_mayhem_mode": true|false`. Eris filters on `=== true`. If the field is missing, the coin counts as unknown and isn't shown.

## UNKNOWN / not found in official sources
- The exact SOL cap per trade, the max trade count, and the max number of coins at once.
- The current buy/sell bias setting.
- The agent wallet address (not on the docs pages I read).
- Whether Auto/Manual replaced the original behaviour for all coins.
- I didn't find official @pumpdotfun X posts during this research pass, so nothing here is sourced from X.
