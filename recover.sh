#!/bin/bash
# One-off recovery: read the Ledger cloud document as it was before the empty
# push, and write that version back. Safe to re-run. Delete after use.
set -u
P=ledger-b892c
U=3h6MdFcqvoNlcYEqQtagBA4iR972
T=${1:-2026-10-01T21:00:00Z}
gcloud config set project "$P" >/dev/null 2>&1
TOK=$(gcloud auth print-access-token 2>/dev/null)
if [ -z "$TOK" ]; then echo "NOT AUTHORISED — tap Authorize in Cloud Shell, then run this again."; exit 1; fi
URL="https://firestore.googleapis.com/v1/projects/$P/databases/(default)/documents/ledgers/$U"
curl -s -H "Authorization: Bearer $TOK" "$URL?readTime=$T" -o /tmp/old.json
SZ=$(wc -c < /tmp/old.json)
echo
echo "=============================================="
echo " old copy at $T"
echo " size: $SZ bytes"
echo "=============================================="
if grep -q '"error"' /tmp/old.json; then
  echo "READ FAILED. Send Claude the text below:"; head -c 500 /tmp/old.json; echo; exit 1; fi
if [ "$SZ" -lt 3000 ]; then
  echo "TOO SMALL to be your data — nothing was restored."
  echo "Send Claude the size above."; exit 0; fi
jq '{fields: .fields}' /tmp/old.json > /tmp/new.json
curl -s -X PATCH -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  "$URL" -d @/tmp/new.json -o /tmp/res.json
if grep -q '"error"' /tmp/res.json; then
  echo "WRITE FAILED. Send Claude the text below:"; head -c 500 /tmp/res.json; echo; exit 1; fi
echo
echo "  *** RESTORED ***"
echo "  Now open Ledger -> Menu -> Cloud backup -> Restore from cloud"
echo "  Enter your passphrase. It should show your real counts."
echo
