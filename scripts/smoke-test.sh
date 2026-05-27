#!/usr/bin/env bash
#
# Frontier Intel Cache — Phase 1 smoke test
# Verifies all external dependencies are alive and behaving as expected.
# Run this any time the build is acting weird to isolate "is it us or is it them?"
#
# Usage:
#   chmod +x scripts/smoke-test.sh
#   ./scripts/smoke-test.sh
#
# Exit codes:
#   0 — all checks passed
#   1 — Walrus publisher down
#   2 — Walrus aggregator down or roundtrip mismatch
#   3 — Tatum Sui RPC down or unexpected response
#

set -uo pipefail

WALRUS_PUBLISHER="https://publisher.walrus-testnet.walrus.space"
WALRUS_AGGREGATOR="https://aggregator.walrus-testnet.walrus.space"
TATUM_SUI_RPC="https://sui-testnet.gateway.tatum.io"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }

echo "════════════════════════════════════════════════════"
echo "  Frontier Intel Cache — Phase 1 Smoke Test"
echo "════════════════════════════════════════════════════"
echo ""

# --- Test 1: Walrus publisher PUT ---
info "Test 1/3: Walrus publisher write"
TEST_PAYLOAD="smoke-test-$(date -u +%Y%m%dT%H%M%SZ)"
PUBLISH_RESPONSE=$(echo "$TEST_PAYLOAD" | curl -s -X PUT \
    "${WALRUS_PUBLISHER}/v1/blobs?epochs=5" \
    --upload-file - 2>&1)

if [ -z "$PUBLISH_RESPONSE" ]; then
    fail "Walrus publisher returned empty response"
    exit 1
fi

BLOB_ID=$(echo "$PUBLISH_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Handles both 'newlyCreated' and 'alreadyCertified' responses
    if 'newlyCreated' in d:
        print(d['newlyCreated']['blobObject']['blobId'])
    elif 'alreadyCertified' in d:
        print(d['alreadyCertified']['blobId'])
    else:
        sys.exit(1)
except Exception:
    sys.exit(1)
" 2>/dev/null)

if [ -z "$BLOB_ID" ]; then
    fail "Could not parse blob ID from publisher response"
    echo "Response was: $PUBLISH_RESPONSE"
    exit 1
fi

pass "Wrote blob: $BLOB_ID"

# --- Test 2: Walrus aggregator GET + roundtrip ---
info "Test 2/3: Walrus aggregator read + roundtrip integrity"
sleep 1  # tiny grace period for propagation
READ_RESPONSE=$(curl -s "${WALRUS_AGGREGATOR}/v1/blobs/${BLOB_ID}" 2>&1)

# Strip trailing newline for comparison
READ_TRIMMED=$(echo "$READ_RESPONSE" | tr -d '\n\r')
PAYLOAD_TRIMMED=$(echo "$TEST_PAYLOAD" | tr -d '\n\r')

if [ "$READ_TRIMMED" != "$PAYLOAD_TRIMMED" ]; then
    fail "Roundtrip mismatch"
    echo "  Sent:     '$PAYLOAD_TRIMMED'"
    echo "  Received: '$READ_TRIMMED'"
    exit 2
fi

pass "Roundtrip OK: '$READ_TRIMMED'"

# --- Test 3: Tatum Sui RPC ---
info "Test 3/3: Tatum Sui testnet RPC"
TATUM_RESPONSE=$(curl -s -X POST "$TATUM_SUI_RPC" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"sui_getLatestCheckpointSequenceNumber","params":[]}' 2>&1)

CHECKPOINT=$(echo "$TATUM_RESPONSE" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print(d.get('result', ''))
except Exception:
    sys.exit(1)
" 2>/dev/null)

if [ -z "$CHECKPOINT" ]; then
    fail "Tatum Sui RPC returned no result"
    echo "Response was: $TATUM_RESPONSE"
    exit 3
fi

pass "Tatum Sui RPC alive — latest checkpoint: $CHECKPOINT"

echo ""
echo "════════════════════════════════════════════════════"
echo -e "  ${GREEN}All 3 checks passed.${NC} External deps healthy."
echo "════════════════════════════════════════════════════"
echo ""
echo "Test blob still readable here:"
echo "  ${WALRUS_AGGREGATOR}/v1/blobs/${BLOB_ID}"
