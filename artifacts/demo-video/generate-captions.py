from pathlib import Path
import re
import subprocess
import json

ROOT = Path(__file__).resolve().parent
VOICE = ROOT / "assets" / "audio"
NARRATION = ROOT / "narration.md"
OUTPUT = ROOT / "captions.srt"
ASS_OUTPUT = ROOT / "captions.ass"
STARTS = [0, 12, 35, 130, 185, 250, 280]


def paragraph_sections():
    text = NARRATION.read_text(encoding="utf-8")
    sections = re.findall(r"^## \d\d:\d\d[^\n]*\n\n(.*?)(?=\n\n## |\Z)", text, re.M | re.S)
    return [re.sub(r"\s+", " ", item.strip()) for item in sections]


def duration(path):
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def wrap(text, width=42):
    words, lines, line = text.split(), [], ""
    for word in words:
        if line and len(line) + 1 + len(word) > width:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}" if line else word
    if line:
        lines.append(line)
    return "\n".join(lines)


def caption_phrases(text, limit=84):
    phrases, words, length = [], [], 0
    for word in text.split():
        next_length = length + len(word) + (1 if words else 0)
        if words and next_length > limit:
            phrases.append(" ".join(words))
            words, length = [], 0
        words.append(word)
        length += len(word) + (1 if len(words) > 1 else 0)
    if words:
        phrases.append(" ".join(words))
    return phrases


def align_words(text, events, scene_number, clip_seconds):
    tokens = list(re.finditer(r"[\w]+(?:['’][\w]+)*", text, re.UNICODE))
    times_by_position = {}
    for event in events:
        position = event["characterPosition"]
        times_by_position[position] = (
            float(event["audioPositionSeconds"]),
            float(event["audioEndSeconds"]),
        )
    missing = [token.group() for token in tokens if token.start() not in times_by_position]
    if missing or len(tokens) != len(times_by_position):
        raise SystemExit(f"Scene {scene_number}: Kokoro timings do not match narration tokens; missing={missing[:8]}")
    aligned = []
    for token in tokens:
        start, end = times_by_position[token.start()]
        start = max(0.0, min(start, clip_seconds))
        end = max(start + 0.04, min(end, clip_seconds))
        aligned.append((token, start, end))
    return aligned


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3_600_000)
    minutes, milliseconds = divmod(milliseconds, 60_000)
    seconds, milliseconds = divmod(milliseconds, 1_000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"


sections = paragraph_sections()
if len(sections) != 7:
    raise SystemExit(f"Expected 7 narration sections; found {len(sections)}")

timing_path = VOICE / "speech-timings.json"
timings = json.loads(timing_path.read_text(encoding="utf-8-sig"))
if len(timings["scenes"]) != len(sections):
    raise SystemExit("Kokoro word timing scene count does not match narration.")

cues = []
for index, content in enumerate(sections):
    wav = VOICE / f"scene-{index + 1:02d}.wav"
    clip_seconds = duration(wav)
    words = align_words(content, timings["scenes"][index]["events"], index + 1, clip_seconds)
    cursor = 0
    while cursor < len(words):
        first = cursor
        cursor += 1
        while cursor < len(words) and len(content[words[first][0].start():words[cursor][0].end()]) <= 76:
            cursor += 1
        token = words[first][0]
        next_position = words[cursor][0].start() if cursor < len(words) else len(content)
        phrase = content[token.start():next_position].strip()
        start = words[first][1]
        end = words[cursor - 1][2]
        if cursor < len(words) and end > words[cursor][1]:
            end = max(start + 0.04, words[cursor][1])
        text = wrap(phrase)
        placement = ""
        if index == 2:
            placement = r"{\an7\pos(95,780)}"
        elif index == 3:
            placement = r"{\an8\pos(1500,850)}"
        cues.append((STARTS[index] + start, STARTS[index] + end, text, placement))

lines = []
ass_lines = [
    "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1920", "PlayResY: 1080",
    "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Default,Arial,36,&H00FFFFFF,&H000000FF,&H80000000,&H4A000000,1,0,0,0,100,100,0,0,3,12,0,2,56,56,56,1",
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
]

def ass_timestamp(seconds):
    centiseconds = round(seconds * 100)
    hours, centiseconds = divmod(centiseconds, 360000)
    minutes, centiseconds = divmod(centiseconds, 6000)
    whole, centiseconds = divmod(centiseconds, 100)
    return f"{hours}:{minutes:02d}:{whole:02d}.{centiseconds:02d}"

for number, (start, end, text, placement) in enumerate(cues, 1):
    lines.extend([str(number), f"{timestamp(start)} --> {timestamp(end)}", text, ""])
    ass_text = placement + text.replace("\n", r"\N")
    ass_lines.append(f"Dialogue: 0,{ass_timestamp(start)},{ass_timestamp(end)},Default,,0,0,0,,{ass_text}")
OUTPUT.write_text("\n".join(lines), encoding="utf-8-sig")
ASS_OUTPUT.write_text("\n".join(ass_lines) + "\n", encoding="utf-8-sig")
print(f"Wrote {len(cues)} cues to {OUTPUT}")
