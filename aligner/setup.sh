#!/bin/bash
# setup.sh — یک‌بار اجرا شود تا همه‌چیز نصب شود.
# اجرا: bash setup.sh
set -e
cd "$(dirname "$0")"

echo "=== ۱) نصب نرم‌افزارهای سیستمی (ffmpeg, espeak-ng, پایتون) ==="
sudo apt update
sudo apt install -y ffmpeg espeak-ng libespeak-ng-dev python3-pip python3-venv

echo ""
echo "=== ۲) ساخت محیط مجازی پایتون ==="
python3 -m venv venv

echo ""
echo "=== ۳) نصب کتابخانه‌های پایتون (aeneas, python-docx, ...) ==="
source venv/bin/activate
pip install --upgrade pip
# نصب numpy قبل از aeneas ضروری است، چون aeneas هنگام ساخت به numpy نیاز دارد
pip install "numpy<2.0"
pip install --no-build-isolation aeneas
pip install python-docx

echo ""
echo "=========================================="
echo "نصب با موفقیت کامل شد."
echo "از این به بعد فقط کافیست فایل‌های سخنرانی را در پوشه‌ی lectures بگذارید"
echo "و دستور زیر را بزنید:"
echo "    bash run.sh"
echo "=========================================="
