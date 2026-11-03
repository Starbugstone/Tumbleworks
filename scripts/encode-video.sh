#!/usr/bin/env bash
# Encodes the frames from scripts/record-video.mjs into an MP4 a phone plays: output/current/videos/<name>.mp4
set -euo pipefail
name="$1"
dir="output/current/videos/$name"
ffmpeg -loglevel error -y -framerate "${VIDEO_FPS:-30}" -i "$dir/f%04d.jpg" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart "output/current/videos/$name.mp4"
echo "output/current/videos/$name.mp4"
