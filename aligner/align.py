#!/usr/bin/env python3
"""
align.py — ابزار دسته‌ای هم‌ترازی متن با صوت/ویدیو (Forced Alignment)

این اسکریپت به‌صورت آفلاین و رایگان، برای هر جفت (فایل متن، فایل صوت/ویدیو)
یک فایل JSON زمان‌بندی تولید می‌کند که برنامه‌ی Blazor برای هایلایت‌کردن
جمله‌ها هنگام پخش از آن استفاده می‌کند.

هیچ متنی از روی صوت تولید نمی‌شود (ASR نیست)؛ متن از قبل مشخص است و فقط
زمان شروع/پایان هر جمله در فایل صوتی پیدا می‌شود (Forced Alignment).

نیازمندی‌های سیستمی (باید قبل از اجرا نصب شوند، همه رایگان/آفلاین):
    - ffmpeg          (برای استخراج صدا از فایل‌های ویدیویی)
    - espeak-ng        (موتور مورد استفاده‌ی aeneas برای هم‌ترازی)
نیازمندی‌های پایتون:
    pip install -r requirements.txt

نحوه‌ی استفاده (دسته‌ای روی یک پوشه):
    python align.py --input-dir ./lectures --output-dir ./timings --language fas

    در پوشه‌ی ورودی باید فایل متن و فایل رسانه هم‌نام باشند، مثلاً:
        lecture1.txt   و   lecture1.mp4
        lecture2.docx  و   lecture2.mp3

نحوه‌ی استفاده (تک فایل):
    python align.py --text lecture1.txt --media lecture1.mp4 --output lecture1.json --language fas

نکته درباره‌ی زبان: کد "fas" برای فارسی در aeneas/espeak-ng استفاده می‌شود.
اگر کیفیت هم‌ترازی فارسی راضی‌کننده نبود، در README همین پوشه توضیح
داده‌ام که چطور می‌توان به‌جای aeneas از WhisperX (روش جایگزین) استفاده کرد.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

TEXT_EXTENSIONS = [".txt", ".docx"]
MEDIA_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".mp4", ".webm", ".mov", ".mkv", ".avi"]
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi"}


def read_text_file(path: Path) -> str:
    """متن را از فایل txt یا docx می‌خواند."""
    if path.suffix.lower() == ".docx":
        try:
            import docx  # python-docx
        except ImportError:
            sys.exit(
                "برای خواندن فایل .docx باید کتابخانه‌ی python-docx نصب شود:\n"
                "    pip install python-docx"
            )
        document = docx.Document(str(path))
        return "\n".join(p.text for p in document.paragraphs)
    else:
        return path.read_text(encoding="utf-8")


def split_into_sentences(text: str):
    """
    دقیقاً همان الگوریتم تقسیم جمله‌ای که در سمت Blazor/C# استفاده می‌شود:
    تقسیم بر اساس نقطه، حذف فاصله‌های اضافه، و نگه‌داشتن نقطه در انتهای هر جمله.
    این هم‌سانی بین پایتون و C# حیاتی است تا شماره‌ی هر جمله (id) در هر دو طرف
    دقیقاً به یک جمله‌ی یکسان اشاره کند.
    """
    normalized = text.replace("\r\n", " ").replace("\n", " ").replace("\r", " ")
    raw_parts = normalized.split(".")
    sentences = []
    for part in raw_parts:
        trimmed = " ".join(part.split())  # حذف فاصله‌های تکراری
        if trimmed:
            sentences.append(trimmed + ".")
    return sentences


def extract_audio_if_needed(media_path: Path, workdir: Path) -> Path:
    """اگر فایل ورودی ویدیو باشد، صدا را با ffmpeg در یک فایل wav موقت استخراج می‌کند."""
    if media_path.suffix.lower() not in VIDEO_EXTENSIONS:
        return media_path

    wav_path = workdir / (media_path.stem + "_extracted.wav")
    cmd = [
        "ffmpeg", "-y", "-i", str(media_path),
        "-ac", "1", "-ar", "16000", "-vn", str(wav_path),
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if result.returncode != 0:
        sys.exit(
            f"استخراج صدا از ویدیوی {media_path.name} با ffmpeg شکست خورد:\n"
            f"{result.stderr.decode(errors='ignore')}"
        )
    return wav_path


def run_aeneas_alignment(audio_path: Path, sentences: list, language: str, workdir: Path):
    """با aeneas، زمان شروع/پایان هر جمله را در فایل صوتی پیدا می‌کند."""
    try:
        from aeneas.executetask import ExecuteTask
        from aeneas.task import Task
    except ImportError:
        sys.exit(
            "کتابخانه‌ی aeneas نصب نیست یا به‌درستی نصب نشده است.\n"
            "نصب: pip install aeneas   (و نصب سیستمی ffmpeg + espeak-ng؛ به README مراجعه کنید)"
        )

    # فایل متنی fragments برای aeneas: هر خط = یک جمله
    fragments_path = workdir / "fragments.txt"
    fragments_path.write_text("\n".join(sentences), encoding="utf-8")

    config_string = (
        f"task_language={language}|"
        "is_text_type=plain|"
        "os_task_file_format=json"
    )
    task = Task(config_string=config_string)
    task.audio_file_path_absolute = str(audio_path)
    task.text_file_path_absolute = str(fragments_path)

    output_sync_path = workdir / "syncmap.json"
    task.sync_map_file_path_absolute = str(output_sync_path)

    ExecuteTask(task).execute()
    task.output_sync_map_file()

    sync_data = json.loads(output_sync_path.read_text(encoding="utf-8"))
    fragments = sync_data.get("fragments", [])

    timings = []
    for i, frag in enumerate(fragments):
        timings.append({
            "id": i,
            "text": sentences[i] if i < len(sentences) else frag.get("lines", [""])[0],
            "start": float(frag["begin"]),
            "end": float(frag["end"]),
        })
    return timings


def process_pair(text_path: Path, media_path: Path, output_path: Path, language: str):
    print(f"در حال پردازش: {text_path.name}  +  {media_path.name}")
    raw_text = read_text_file(text_path)
    sentences = split_into_sentences(raw_text)
    if not sentences:
        print(f"  هشدار: هیچ جمله‌ای در {text_path.name} پیدا نشد (چک کنید که با نقطه پایان می‌یابد).")
        return

    with tempfile.TemporaryDirectory() as tmp:
        workdir = Path(tmp)
        audio_path = extract_audio_if_needed(media_path, workdir)
        timings = run_aeneas_alignment(audio_path, sentences, language, workdir)

    result = {
        "source_text_file": text_path.name,
        "media_file": media_path.name,
        "sentence_count": len(sentences),
        "sentences": timings,
    }
    output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  ذخیره شد: {output_path}  ({len(timings)} جمله)")


def find_pairs(input_dir: Path):
    """فایل‌های متنی و رسانه‌ای هم‌نام را در پوشه‌ی ورودی پیدا می‌کند."""
    files = list(input_dir.iterdir())
    text_files = {f.stem: f for f in files if f.suffix.lower() in TEXT_EXTENSIONS}
    media_files = {f.stem: f for f in files if f.suffix.lower() in MEDIA_EXTENSIONS}

    pairs = []
    for stem, text_path in text_files.items():
        if stem in media_files:
            pairs.append((text_path, media_files[stem]))
        else:
            print(f"هشدار: برای «{text_path.name}» فایل رسانه‌ی هم‌نام پیدا نشد؛ رد شد.")
    return pairs


def main():
    parser = argparse.ArgumentParser(description="هم‌ترازی دسته‌ای متن سخنرانی با فایل صوت/ویدیو")
    parser.add_argument("--input-dir", help="پوشه‌ای حاوی جفت فایل‌های متن+رسانه‌ی هم‌نام (حالت دسته‌ای)")
    parser.add_argument("--output-dir", help="پوشه‌ی خروجی برای فایل‌های JSON (حالت دسته‌ای)")
    parser.add_argument("--text", help="فایل متن (حالت تک‌فایل)")
    parser.add_argument("--media", help="فایل صوت/ویدیو (حالت تک‌فایل)")
    parser.add_argument("--output", help="فایل JSON خروجی (حالت تک‌فایل)")
    parser.add_argument("--language", default="fas", help="کد زبان برای aeneas/espeak-ng (پیش‌فرض: fas یعنی فارسی)")
    args = parser.parse_args()

    if args.input_dir:
        input_dir = Path(args.input_dir)
        output_dir = Path(args.output_dir or "./timings")
        output_dir.mkdir(parents=True, exist_ok=True)
        pairs = find_pairs(input_dir)
        if not pairs:
            sys.exit("هیچ جفت فایل متن+رسانه‌ای در پوشه‌ی ورودی پیدا نشد.")
        for text_path, media_path in pairs:
            output_path = output_dir / (text_path.stem + ".json")
            process_pair(text_path, media_path, output_path, args.language)
    elif args.text and args.media:
        output_path = Path(args.output or (Path(args.text).stem + ".json"))
        process_pair(Path(args.text), Path(args.media), output_path, args.language)
    else:
        parser.error("یا --input-dir را بدهید (حالت دسته‌ای) یا --text و --media (حالت تک‌فایل).")


if __name__ == "__main__":
    main()
