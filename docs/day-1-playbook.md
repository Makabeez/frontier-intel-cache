# Day 1 Playbook — Wed May 28

> Today is May 27 evening. By end of Wed May 28 we need: smoke test green on Joe's machine, Move contract compiled locally, backend imports clean, X build-in-public post live.

## ☑️ Pre-flight (do tonight if possible)

- [ ] Sign up at https://dashboard.tatum.io and grab API key. Save it to a notes file (we use it Day 3 when rate limits matter).
- [ ] Join Tatum Discord `#hackathon`: https://discord.gg/Ttp9zJwPqa
- [ ] Join Walrus Discord: https://discord.com/invite/walrusprotocol
- [ ] Create a dedicated X handle for the project (per losing-pattern fix #4). Suggestion: `@FrontierIntel` or `@IntelCacheXYZ`. Cross-post from `@GeiserJoe2`.

## ☑️ Phase 0 — Drop files into `C:\Github\frontier-intel-cache`

Unzip the delivered bundle into `C:\Github\frontier-intel-cache`. Should end up with:
```
frontier-intel-cache/
├── README.md
├── LICENSE
├── .gitignore
├── backend/        (main.py, walrus_client.py, tatum_sui_client.py, requirements.txt, .env.example)
├── frontend/       (skeleton — built Day 4)
├── smart-contract/ (sources/intel_beacon.move, tests/, Move.toml)
├── scripts/        (smoke-test.sh, e2e_walrus_test.py)
└── docs/           (banner.svg, day-1-playbook.md, etc.)
```

## ☑️ Phase 1 — Smoke test from WSL

```bash
cd /mnt/c/Github/frontier-intel-cache
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

Expected: `All 3 checks passed.` Screenshot this terminal output for the X post.

## ☑️ Phase 2 — Backend imports & E2E Walrus test

```bash
cd /mnt/c/Github/frontier-intel-cache/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run end-to-end Walrus test
cd ..
python scripts/e2e_walrus_test.py
```

Expected: byte-perfect roundtrip, public URL printed. Open the URL in a browser, confirm you see the full JSON intel payload. **Screenshot the browser tab** showing JSON from `aggregator.walrus-testnet.walrus.space`.

## ☑️ Phase 3 — Sui CLI install (if not already done last night)

```bash
curl -sSfL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | sh
source ~/.bashrc
suiup install sui@testnet
sui --version
```

## ☑️ Phase 4 — Build Move contract locally

```bash
cd /mnt/c/Github/frontier-intel-cache/smart-contract
sui move build
sui move test
```

Expected: clean build, 6 tests pass. Screenshot test output.

## ☑️ Phase 5 — Set up Sui testnet wallet & faucet

```bash
sui client switch --env testnet || sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
sui client active-address    # note this address
# Visit https://faucet.testnet.sui.io/ — paste the address, get SUI
sui client gas               # confirm SUI received
```

## ☑️ Phase 6 — X build-in-public post

Post on `@GeiserJoe2` AND the new dedicated project handle.

**Draft (60-90 chars first line, hook-first per losing-pattern fix #2):**

> Building "Frontier Intel Cache" for the Tatum × Walrus hackathon.
>
> The pitch: tamper-proof intel reports for on-chain games. Sui Move holds the proof, @WalrusFoundation holds the payload.
>
> Day 1: end-to-end Walrus roundtrip working. Real public blob you can verify 👇
>
> https://aggregator.walrus-testnet.walrus.space/v1/blobs/<YOUR_BLOB_ID>
>
> /1 🧵

Then a thread:
- /2 Why this matters (storage cost wall, screenshot example)
- /3 Move contract sneak peek (image of intel_beacon.move)
- /4 What's next this week
- /5 Follow @FrontierIntel for daily updates

Tag `@Tatum_io @WalrusFoundation @SuiNetwork` per hackathon bonus criteria.

## ☑️ Phase 7 — Push to GitHub

```bash
cd /mnt/c/Github/frontier-intel-cache
git init
git add .
git commit -m "Day 1: smoke tests green, Walrus roundtrip verified, Move contract compiles"
gh repo create makabeez/frontier-intel-cache --public --source=. --remote=origin --push
```

## End-of-day target

By 23:59 May 28:
- [ ] Smoke test green
- [ ] Walrus E2E test green
- [ ] Move build + tests green
- [ ] Sui testnet wallet funded
- [ ] GitHub repo public with README rendering
- [ ] X thread live with at least 1 reply or 5 likes (start engagement)
- [ ] In Tatum + Walrus Discord, posted "building X for the hackathon, day 1 update" — start recruiting testers early
