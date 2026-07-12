#!/usr/bin/env bash
# Proves whether the LIVE model is actually authoring, or you're getting the
# deterministic template. Run with the API up:  bash check_model.sh
set -e
echo "1) Is the key set in THIS shell?"
if [ -z "$ANTHROPIC_API_KEY" ]; then echo "   NO — export ANTHROPIC_API_KEY before starting uvicorn"; else echo "   yes (${ANTHROPIC_API_KEY:0:8}…)"; fi

echo "2) Backend health / model status:"
curl -s http://127.0.0.1:8000/api/health | python3 -m json.tool

echo "3) Live author call — look at used_model:"
curl -s -X POST http://127.0.0.1:8000/api/author \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Seed pitch for an AI-native retail platform","use_model":true}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('   used_model:', d.get('used_model')); print('   first line:', d.get('spec','').split(chr(10))[0])"
echo ""
echo "If used_model is False, the model isn't authoring. Fixes, in order:"
echo "  a) export ANTHROPIC_API_KEY=sk-ant-...   (in the SAME shell as uvicorn)"
echo "  b) export SLIDELANG_MODEL=claude-sonnet-5   (or a model your key can access)"
echo "  c) restart uvicorn, re-run this script"
