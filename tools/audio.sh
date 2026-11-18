#!/usr/bin/env bash
# Builds English narration + ambient score, aligned to the 30 x 10s scene grid.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=out/audio
rm -rf "$OUT"; mkdir -p "$OUT/en"
SCENE_SECONDS=10
DURATION=$(node -e "const t=require('./public/timeline.json');console.log(t.scenes.length*t.sceneSeconds)")
VOICE=${VOICE:-en-US-AriaNeural}
RATE=${RATE:--8%}
DG_MODEL=${DG_MODEL:-aura-2-draco-en}
DG_SPEED=${DG_SPEED:-0.95}

# API key: env first, then local key file (never committed)
if [ -z "${DEEPGRAM_API_KEY:-}" ] && [ -f "$HOME/.deepgram_key" ]; then
  DEEPGRAM_API_KEY=$(cat "$HOME/.deepgram_key")
fi

TTS_ENGINE=none
if [ -n "${DEEPGRAM_API_KEY:-}" ]; then
  TTS_ENGINE=deepgram
elif command -v edge-tts >/dev/null 2>&1; then
  TTS_ENGINE=edge
fi
[ -z "${TTS_ENGINE##*none*}" ] && TTS_ENGINE=espeak

echo "[audio] duration=${DURATION}s engine=${TTS_ENGINE} dg_model=${DG_MODEL} edge_voice=${VOICE}"

dg_speak() { # text outfile  -- retries on 429/5xx
  local text="$1" out="$2" attempt=1
  local body
  body=$(printf '%s' "$text" | python3 -c 'import json,sys;print(json.dumps({"text":sys.stdin.read()}))')
  while [ "$attempt" -le 4 ]; do
    if curl -sS --fail-with-body -m 90 -o "$out.mp3" \
      -X POST "https://api.deepgram.com/v1/speak?model=${DG_MODEL}&speed=${DG_SPEED}" \
      -H "Authorization: Token ${DEEPGRAM_API_KEY}" \
      -H "Content-Type: application/json" \
      -d "$body"; then
      [ -s "$out.mp3" ] && return 0
    fi
    rm -f "$out.mp3"
    echo "  . deepgram attempt $attempt failed, retrying"
    sleep $(( attempt * 4 ))
    attempt=$(( attempt + 1 ))
  done
  return 1
}

N=$(node -e "console.log(require('./public/timeline.json').scenes.length)")
for i in $(seq 0 $((N-1))); do
  IDX=$(printf "%02d" "$i")
  TEXT=$(node -e "console.log(require('./public/timeline.json').scenes[$i].en)")
  FILE="$OUT/en/$IDX.wav"
  ok=0
  if [ "$TTS_ENGINE" = deepgram ]; then
    if dg_speak "$TEXT" "$OUT/en/$IDX"; then
      if ffmpeg -hide_banner -loglevel error -y -i "$OUT/en/$IDX.mp3" -ar 48000 -ac 1 \
           -af "highpass=f=70,acompressor=threshold=-16dB:ratio=2.5:attack=10:release=200,loudnorm=I=-17:TP=-1.5:LRA=11" "$FILE"; then
        ok=1
        engine_used=deepgram
      fi
    else
      echo "  ! deepgram failed for scene $IDX, falling back"
    fi
  fi
  if [ "$ok" = 0 ] && [ "$TTS_ENGINE" != espeak ] && command -v edge-tts >/dev/null 2>&1; then
    if edge-tts --voice "$VOICE" --rate="$RATE" --text "$TEXT" --write-media "$OUT/en/$IDX.mp3" >/dev/null 2>&1; then
      if ffmpeg -hide_banner -loglevel error -y -i "$OUT/en/$IDX.mp3" -ar 48000 -ac 1 "$FILE"; then
        ok=1
        engine_used=edge
      fi
    fi
  fi
  if [ "$ok" = 0 ]; then
    engine_used=espeak
    espeak-ng -v en-us -s 148 -p 42 -a 175 -w "$FILE.raw.wav" "$TEXT"
    ffmpeg -hide_banner -loglevel error -y -i "$FILE.raw.wav" -ar 48000 -ac 1 \
      -af "highpass=f=90,lowpass=f=9000,acompressor=threshold=-18dB:ratio=3:attack=8:release=180" "$FILE"
    rm -f "$FILE.raw.wav"
  fi
  D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$FILE")
  sleep 0.4
  echo "  scene $IDX  [${engine_used}] tts=$(printf '%.2f' "$D")s"
  if awk "BEGIN{exit !($D > $SCENE_SECONDS - 0.9)}"; then
    echo "  ! scene $IDX narration ${D}s too long for ${SCENE_SECONDS}s slot, speeding up"
    ffmpeg -hide_banner -loglevel error -y -i "$FILE" -ar 48000 -ac 1 \
      -filter:a "atempo=$(awk "BEGIN{printf \"%.3f\", $D/($SCENE_SECONDS-0.9)}")" "$FILE.tmp.wav"
    mv "$FILE.tmp.wav" "$FILE"
  fi
done

# ---- narration track: each clip delayed to its scene start
ARGS=(); FILT=""
for i in $(seq 0 $((N-1))); do
  IDX=$(printf "%02d" "$i")
  ARGS+=(-i "$OUT/en/$IDX.wav")
  MS=$(awk "BEGIN{printf \"%d\", ($i*$SCENE_SECONDS+0.55)*1000}")
  FILT+="[$i:a]adelay=${MS}|${MS},apad[n$i];"
done
MIXIN=""; for i in $(seq 0 $((N-1))); do MIXIN+="[n$i]"; done
ffmpeg -hide_banner -loglevel error -y "${ARGS[@]}" -filter_complex \
  "${FILT}${MIXIN}amix=inputs=${N}:duration=longest:normalize=0,alimiter=limit=0.94,volume=1.25[narr]" \
  -map "[narr]" -t "$DURATION" -ar 48000 -ac 1 "$OUT/narration.wav"
echo "[audio] narration.wav built"

# ---- ambient cinematic score (procedural)
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "aevalsrc=0.20*sin(2*PI*55*t)+0.13*sin(2*PI*82.41*t)+0.10*sin(2*PI*110*t)+0.06*sin(2*PI*164.81*t)*(0.55+0.45*sin(2*PI*0.05*t))+0.05*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.031*t)):s=48000:d=${DURATION}" \
  -f lavfi -i "aevalsrc=0.05*sin(2*PI*(300+40*sin(2*PI*0.02*t))*t)+0.04*sin(2*PI*(450+60*sin(2*PI*0.017*t))*t):s=48000:d=${DURATION}" \
  -filter_complex "[0:a]lowpass=f=900,highpass=f=38,tremolo=f=0.12:d=0.55[a0];[1:a]lowpass=f=4000,tremolo=f=0.17:d=0.8,volume=0.55[a1];[a0][a1]amix=inputs=2:normalize=0,aecho=0.8:0.9:220|480:0.32|0.22,volume=0.42[pad]" \
  -map "[pad]" -t "$DURATION" -ar 48000 -ac 1 "$OUT/pad.wav"
echo "[audio] pad.wav built"

# ---- final mix
ffmpeg -hide_banner -loglevel error -y -i "$OUT/narration.wav" -i "$OUT/pad.wav" -filter_complex \
  "[1:a]volume=0.55[m];[0:a][m]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,afade=t=in:st=0:d=1.5,afade=t=out:st=$((DURATION-3)):d=3[a]" \
  -map "[a]" -t "$DURATION" -c:a aac -b:a 160k "$OUT/mix.m4a"
echo "[audio] mix.m4a built"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT/mix.m4a"
