# PropRail

> USDC payout rail for prop-trading firms. Built on [Arc Testnet](https://docs.arc.network), powered by [Circle Bridge Kit](https://developers.circle.com/bridge-kit) and [CCTP V2](https://developers.circle.com/stablecoins/cctp-getting-started).

Prop-trading firms pay their funded traders in USD-equivalent amounts, often to traders scattered across jurisdictions. PropRail gives them a one-page dashboard to fund a treasury, issue payouts with expiry, and hand traders a claim link. The trader opens the link, picks which chain they want their USDC on, and signs once. Circle's CCTP V2 handles the crosschain delivery; the trader doesn't need gas on the destination chain.

## Live

- **Contract (verified):** [`0xF46E0b43AEf82114DA8a8F62D66bb7b63D3b00b7`](https://testnet.arcscan.app/address/0xF46E0b43AEf82114DA8a8F62D66bb7b63D3b00b7) on Arc Testnet
- **Demo:** coming soon (Vercel deploy in progress)

## How it works

1. **Prop firm admin** funds the treasury on Arc, creates payouts (one-off or batch from CSV), and shares claim links with traders
2. **Trader** opens their claim link, picks a destination chain, signs once
3. **Contract** burns USDC on Arc via CCTP V2
4. **Bridge Kit** polls Circle's attestation service and submits the destination-chain mint via the Orbit forwarder
5. **Trader** receives native USDC on their chosen chain with no destination-chain gas required

## Why Arc + Bridge Kit

- **USDC-as-gas on Arc** means the prop firm funds the treasury in one asset and pays fees in the same asset. No second token to source.
- **CCTP V2 via Bridge Kit** means the trader gets native USDC on their chosen chain, not a bridged wrapper. With the Orbit forwarder, the trader does not need ETH on the destination chain.
- **Single-signature UX** — the trader signs once on Arc; Circle infrastructure handles everything downstream.

## Features

- Admin dashboard with live treasury balance, committed vs unallocated USDC, deposit/withdraw flow
- Single and batch payout creation (upload a CSV for bulk airdrops)
- Live payout history reading onchain events (topic-filtered, chunked for RPC limits)
- Shareable claim links per payout at `/claim/[id]`
- Crosschain claim flow — trader picks Base Sepolia, Ethereum Sepolia, or Arbitrum Sepolia
- Owner-gated admin access — dashboard reads the contract's `owner()` and locks out other wallets
- Payout expiry — firm can reclaim expired payouts

## Tech stack

| Layer | Choice |
|---|---|
| Smart contract | Solidity 0.8.22, OpenZeppelin 5.1.0, Foundry |
| Frontend | Next.js 16 (App Router), Tailwind CSS 4 |
| Wallet | RainbowKit 2 + wagmi 2 + viem 2 |
| Crosschain | @circle-fin/bridge-kit 1.8.3 + @circle-fin/provider-cctp-v2 |
| Chain | Arc Testnet (chain id 5042002, USDC as gas) |

## Contract

`PayoutEscrow.sol` is a small escrow (about 200 lines) with these responsibilities:

- **Treasury**: owner deposits and withdraws USDC
- **Payout commitments**: owner creates pending payouts with (trader, amount, reference, expiry)
- **Claim**: trader calls `claim(payoutId, destinationDomain, mintRecipient, maxFee, minFinalityThreshold)`. The contract approves Circle's TokenMessengerV2 and calls `depositForBurn`, burning USDC on Arc and emitting a CCTP message for the destination chain.
- **Reclaim**: owner can cancel any expired pending payout

Access control via OpenZeppelin `Ownable`. Reentrancy-guarded on `claim()`. 16 Foundry tests covering happy paths, access control, and invariants — all passing.

## Local development

```bash
# Clone
git clone https://github.com/Makabeez/proprail.git
cd proprail

# Frontend
npm install
# create .env.local with NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and NEXT_PUBLIC_PAYOUT_ESCROW_ADDRESS
npm run dev

# Contract (optional - a deployed instance is already live on Arc Testnet)
cd contracts
forge install
forge test
```

## Repo layout

```
contracts/                         Foundry project
  src/
    PayoutEscrow.sol               main contract
    interfaces/ITokenMessengerV2.sol
  test/PayoutEscrow.t.sol          16 tests

src/
  app/
    admin/page.tsx                 admin dashboard page
    claim/[id]/page.tsx            trader claim page
  components/
    admin/                         Treasury, CreatePayout, PayoutHistory
    claim/                         ClaimForm, ClaimProgress, ClaimSuccess
  lib/
    bridge/                        Bridge Kit integration
    abi/payoutEscrow.ts            contract ABI
    chains.ts                      wagmi chain def for Arc Testnet
    contracts.ts                   deployed contract addresses
```

## Roadmap

- [ ] Vercel deploy + live demo URL
- [ ] `claimToSelf()` variant for traders who want USDC on Arc directly
- [ ] Solana Devnet as a claim destination (Bridge Kit supports it)
- [ ] Custom fee routing for firms taking a payout fee
- [ ] EURC payouts (Arc supports EURC natively)

## License

MIT.

---

Built in the open to explore Circle's Arc + Bridge Kit stack. Feedback welcome — [open an issue](https://github.com/Makabeez/proprail/issues) or ping [@Makabeez](https://github.com/Makabeez).
