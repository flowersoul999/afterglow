#!/usr/bin/env bash
# Edge-TTS 朗读服务自测（在部署服务器上执行）
# 用法：bash 自测.sh [http://127.0.0.1:8000]
set -euo pipefail
BASE="${1:-http://127.0.0.1:8000}"

echo "== 1. 健康检查 =="
curl -sf "$BASE/health"
echo

echo "== 2. 容器内连微软（列音色前 5 个） =="
docker compose exec -T tts edge-tts --list-voices > /tmp/tts-voices.txt
head -n 5 /tmp/tts-voices.txt

echo "== 3. 合成一段音频 =="
TEXT="你好，这是博客朗读服务的自测音频。Hello world, this is a test."
ID=$(curl -sf -X POST "$BASE/tts" -H "Content-Type: application/json" \
  -d "{\"text\":\"$TEXT\",\"voice\":\"zh-CN-XiaoxiaoNeural\"}" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "id=$ID"

curl -sf "$BASE/audio/$ID" -o /tmp/tts-test.mp3
ls -lh /tmp/tts-test.mp3

echo "== 4. 缓存命中（Range 应返回 206） =="
curl -s -D /tmp/tts-headers.txt -o /dev/null -H "Range: bytes=0-1023" "$BASE/audio/$ID"
grep -q " 206 " /tmp/tts-headers.txt
head -n 6 /tmp/tts-headers.txt

echo "== 全部通过，试听 /tmp/tts-test.mp3 =="
