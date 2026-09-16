#!/bin/bash
# run.sh — هر بار که خواستید سخنرانی‌های داخل پوشه‌ی lectures را پردازش کنید، این را بزنید.
# اجرا: bash run.sh
# (اختیاری: bash run.sh مسیر_ورودی مسیر_خروجی زبان)
set -e
cd "$(dirname "$0")"

if [ ! -d "venv" ]; then
    echo "به نظر می‌رسد هنوز setup.sh را اجرا نکرده‌اید."
    echo "اول این را بزنید:  bash setup.sh"
    exit 1
fi

source venv/bin/activate

INPUT_DIR="${1:-../lectures}"
OUTPUT_DIR="${2:-../timings}"
LANGUAGE="${3:-fas}"

mkdir -p "$INPUT_DIR" "$OUTPUT_DIR"

python align.py --input-dir "$INPUT_DIR" --output-dir "$OUTPUT_DIR" --language "$LANGUAGE"

echo ""
echo "=========================================="
echo "تمام شد. فایل‌های JSON آماده‌اند در:"
echo "    $(cd "$OUTPUT_DIR" && pwd)"
echo "همین فایل‌های JSON را در برنامه‌ی Blazor بارگذاری کنید."
echo "=========================================="
