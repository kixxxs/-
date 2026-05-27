#!/bin/bash
# Batch convert existing H.265 videos to H.264

VIDEO_DIRS=(
  "/app/server/src/assets/videos"
  "/app/server/src/assets/reserve_videos"
)

TOTAL=0
CONVERTED=0
SKIPPED=0

echo "============================================"
echo "  扫描并转换 H.265 视频为 H.264"
echo "============================================"
echo ""

for DIR in "${VIDEO_DIRS[@]}"; do
  if [ ! -d "$DIR" ]; then
    echo "[跳过] 目录不存在: $DIR"
    continue
  fi

  echo "[扫描] $DIR"
  while IFS= read -r -d '' FILE; do
    TOTAL=$((TOTAL + 1))
    BASENAME=$(basename "$FILE")

    CODEC=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name \
      -of default=noprint_wrappers=1:nokey=1 "$FILE" 2>/dev/null || echo "unknown")

    if [ "$CODEC" = "hevc" ] || [ "$CODEC" = "hvc1" ] || [ "$CODEC" = "hev1" ]; then
      SIZE_MB=$(du -m "$FILE" | cut -f1)
      echo "  [转换] $BASENAME (${SIZE_MB}MB, $CODEC -> H.264)"
      TMP="${FILE%.*}_conv.mp4"
      if ffmpeg -i "$FILE" -c:v libx264 -preset ultrafast -crf 23 -c:a aac -b:a 128k -y "$TMP" 2>&1 | tail -3; then
        rm -f "$FILE"
        mv "$TMP" "$FILE"
        CONVERTED=$((CONVERTED + 1))
        echo "    -> 完成"
      else
        echo "    -> 失败，保留原文件"
        rm -f "$TMP"
      fi
    else
      echo "  [跳过] $BASENAME ($CODEC)"
      SKIPPED=$((SKIPPED + 1))
    fi
  done < <(find "$DIR" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.webm" \) -print0)
done

echo ""
echo "============================================"
echo "  完成: 共 $TOTAL 个视频, 转换 $CONVERTED 个, 跳过 $SKIPPED 个"
echo "============================================"
