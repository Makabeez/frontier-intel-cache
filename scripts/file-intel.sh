#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="$REPO_ROOT/backend/.env"
if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
fi

PKG="${FRONTIER_INTEL_PACKAGE_ID:-}"
BEACON="${FRONTIER_BEACON_ID:-}"
[ -z "$PKG" ] && { echo "ERROR: FRONTIER_INTEL_PACKAGE_ID not set" >&2; exit 1; }
[ -z "$BEACON" ] && { echo "ERROR: FRONTIER_BEACON_ID not set" >&2; exit 1; }

SYSTEM_ID="${SYSTEM_ID:-30000142}"
SYSTEM_NAME="${SYSTEM_NAME:-Jita}"
INTEL_TYPE="${INTEL_TYPE:-scout_report}"
THREAT_LEVEL="${THREAT_LEVEL:-3}"
SUMMARY="${SUMMARY:-Roaming gang camping outbound gate}"
WALRUS_PUBLISHER="${WALRUS_PUBLISHER_URL:-https://publisher.walrus-testnet.walrus.space}"
WALRUS_AGGREGATOR="${WALRUS_AGGREGATOR_URL:-https://aggregator.walrus-testnet.walrus.space}"
CLOCK="0x6"
GAS_BUDGET="${GAS_BUDGET:-50000000}"
NOW_MS=$(( $(date +%s) * 1000 ))

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${YELLOW}->${NC} $1"; }
pass() { echo -e "${GREEN}OK${NC} $1"; }

PAYLOAD=$(SYSTEM_ID="$SYSTEM_ID" SYSTEM_NAME="$SYSTEM_NAME" INTEL_TYPE="$INTEL_TYPE" \
  THREAT_LEVEL="$THREAT_LEVEL" SUMMARY="$SUMMARY" NOW_MS="$NOW_MS" python3 -c "
import json, os, sys
intel = {
    'version': 1,
    'system_id': os.environ['SYSTEM_ID'],
    'system_name': os.environ['SYSTEM_NAME'],
    'intel_type': os.environ['INTEL_TYPE'],
    'threat_level': int(os.environ['THREAT_LEVEL']),
    'summary': os.environ['SUMMARY'],
    'submitted_at_ms': int(os.environ['NOW_MS']),
    'payload': {
        'observed_ships': [
            {'class': 'battleship', 'count': 3, 'alliance': 'Goonswarm'},
            {'class': 'logistics', 'count': 2, 'alliance': 'Goonswarm'},
            {'class': 'interceptor', 'count': 4, 'alliance': 'Unknown'},
        ],
        'estimated_duration_minutes': 120,
        'evasion_route': ['30000139', '30000136'],
        'notes': 'Heavy logi support. Do not engage solo.',
        'scout_signature': 'cli-demo-' + str(int(os.environ['NOW_MS']))[-8:],
    },
}
sys.stdout.write(json.dumps(intel, separators=(',',':'), ensure_ascii=False))
")

echo "===================================================="
echo "  Filing intel: ${SYSTEM_NAME} (${SYSTEM_ID}) - ${INTEL_TYPE}"
echo "===================================================="

info "Step 1/2: Uploading payload to Walrus (${#PAYLOAD} bytes)"
WALRUS_RESPONSE=$(echo -n "$PAYLOAD" | curl -s -X PUT \
    "${WALRUS_PUBLISHER}/v1/blobs?epochs=5" --upload-file -)

BLOB_ID=$(echo "$WALRUS_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if 'newlyCreated' in d:
    print(d['newlyCreated']['blobObject']['blobId'])
elif 'alreadyCertified' in d:
    print(d['alreadyCertified']['blobId'])
")

if [ -z "$BLOB_ID" ]; then
    echo "ERROR parsing blob_id" >&2
    echo "$WALRUS_RESPONSE" >&2
    exit 2
fi

pass "Walrus blob_id: $BLOB_ID"
echo "   Public URL:   ${WALRUS_AGGREGATOR}/v1/blobs/${BLOB_ID}"
echo ""

info "Step 2/2: Calling submit_intel(...) on Sui testnet"

sui client call \
    --package "$PKG" \
    --module intel_beacon \
    --function submit_intel \
    --args \
        "$BEACON" \
        "$SYSTEM_ID" \
        "$INTEL_TYPE" \
        "$THREAT_LEVEL" \
        "$BLOB_ID" \
        "$SUMMARY" \
        "$CLOCK" \
    --gas-budget "$GAS_BUDGET"

echo ""
echo "===================================================="
echo "  DONE. Intel filed end-to-end."
echo "===================================================="
echo "Walrus payload:  ${WALRUS_AGGREGATOR}/v1/blobs/${BLOB_ID}"
echo "Beacon on-chain: https://suiscan.xyz/testnet/object/${BEACON}"
