import asyncio, json, os, subprocess
import edge_tts

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, 'audio', 'vo')
os.makedirs(OUT, exist_ok=True)

LINES = [
    ("01", "网页版 DeepSeek，还切浏览器？", "+18%"),
    ("02", "装个插件，直接开在 DSH 里。", "+14%"),
    ("03", "登录就能用，不切窗口。", "+14%"),
    ("04", "DeepSeek 常驻，重启也还在。", "+16%"),
    ("05", "标签页背景，也能自己换。", "+12%"),
    ("06", "渐变、纯色、图片都行。", "+16%"),
    ("07", "右键、历史、Chrome 都在。", "+16%"),
    ("08", "开源免费，GitHub 搜 dsh-web-browser，点个 Star。", "+16%"),
]

async def main():
    voice = "zh-CN-YunxiNeural"
    results = []
    for idx, text, rate in LINES:
        mp3 = os.path.join(OUT, f"line{idx}.mp3")
        wav = os.path.join(OUT, f"line{idx}.wav")
        await edge_tts.Communicate(text, voice, rate=rate).save(mp3)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ar", "48000", "-ac", "1", wav], check=True)
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                             "-of", "default=nw=1:nk=1", wav]).decode().strip())
        results.append({"id": idx, "text": text, "rate": rate, "dur": round(dur, 3)})
        print(idx, round(dur, 2), text)
    print("TOTAL", round(sum(r["dur"] for r in results), 2))
    with open(os.path.join(OUT, 'timings.json'), 'w') as f:
        json.dump(results, f, ensure_ascii=False, indent=1)

asyncio.run(main())
