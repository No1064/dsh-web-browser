#!/bin/sh
# Rebuild the SWISS MOTION 10 s test film from scratch.
#   LIB      the lemo-opuscar library clone (core tools; MIT)
#   CHROME   a Chrome/Chromium executable for the headless renderer
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$HOME/lemo-opuscar}
export PLAYWRIGHT_CHROME=${PLAYWRIGHT_CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the lemo-opuscar library folder"; exit 1; }

cd "$LIB"
node core/render/readcheck.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 30 --workers 3 --out "$HERE/out/video.mp4"
python3 "$HERE/audio/make_audio.py"
# pre-master: loudnorm does not limit true peaks in linear mode, so limit before muxing
ffmpeg -y -v error -i "$HERE/audio/mix.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11,alimiter=limit=0.75:level=disabled" -ar 48000 -ac 2 "$HERE/audio/mix_mastered.wav"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/audio/mix_mastered.wav" "$HERE/out/swiss-motion-10s.mp4" 30 0
node core/render/still.mjs "$HERE" 8.2
cp "$HERE/stills/t_8.2.jpg" "$HERE/out/poster.jpg"
echo "done: $HERE/out/swiss-motion-10s.mp4"
