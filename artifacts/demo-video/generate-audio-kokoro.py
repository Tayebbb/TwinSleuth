from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro


ROOT = Path(__file__).resolve().parent
AUDIO_DIR = ROOT / "assets" / "audio"
MODEL_DIR = Path.home() / "AppData" / "Local" / "TwinSleuth-Kokoro" / "models"
VOICE = "af_heart"
SPEED = 1.15
TOKEN = re.compile(r"[\w]+(?:['’][\w]+)*", re.UNICODE)
PRONUNCIATIONS = {
    "TwinSleuth": "Twin Sleuth",
    "P4's": "P four's",
    "95": "ninety five",
    "P1": "P one",
    "P3": "P three",
    "P4": "P four",
    "H1": "H one",
    "H2": "H two",
    "H3": "H three",
    "H4": "H four",
    "J2": "J two",
}


def sections() -> list[str]:
    text = (ROOT / "narration.md").read_text(encoding="utf-8")
    found = re.findall(r"^## \d\d:\d\d[^\n]*\n\n(.*?)(?=\n\n## |\Z)", text, re.M | re.S)
    return [re.sub(r"\s+", " ", section.strip()) for section in found]


def phoneme_word_times(engine, timings, phonemes: str, spoken_words, scene: int):
    rendered = "".join(item.phoneme for item in timings)
    if re.sub(r"\s+", "", rendered) != re.sub(r"\s+", "", phonemes):
        raise RuntimeError(f"Scene {scene}: phoneme timing stream differs from Kokoro input.")

    groups = []
    chars = []
    start = end = None
    for item in timings:
        if item.phoneme.isspace():
            if chars:
                groups.append((start, end))
                chars, start, end = [], None, None
            continue
        if start is None:
            start = item.start
        end = item.end
        chars.append(item.phoneme)
        if item.phoneme in ".,!?;:":
            groups.append((start, end))
            chars, start, end = [], None, None
    if chars:
        groups.append((start, end))

    def normalize(value: str) -> str:
        decomposed = unicodedata.normalize("NFKD", value.lower())
        return "".join(char for char in decomposed if char.isalpha() and char not in "ˈˌː")

    def edit_distance(left: str, right: str) -> int:
        row = list(range(len(right) + 1))
        for i, a in enumerate(left, 1):
            next_row = [i]
            for j, b in enumerate(right, 1):
                next_row.append(min(next_row[-1] + 1, row[j] + 1, row[j - 1] + (a != b)))
            row = next_row
        return row[-1]

    # Rebuild the timed phoneme groups, retaining their exact ONNX word edges.
    actual = []
    char_group = []
    for item in timings:
        if item.phoneme.isspace():
            if char_group:
                actual.append((normalize("".join(char_group)), len(actual)))
                char_group = []
        else:
            char_group.append(item.phoneme)
            if item.phoneme in ".,!?;:":
                actual.append((normalize("".join(char_group)), len(actual)))
                char_group = []
    if char_group:
        actual.append((normalize("".join(char_group)), len(actual)))

    expected = [normalize(engine.tokenizer.phonemize(word.group(), "en-us")) for word in spoken_words]
    # Some connected English phrases collapse across written word boundaries
    # (for example, "not a"). Align those merged phonemes to both source words.
    n, m = len(expected), len(actual)
    best = [[(float("inf"), None) for _ in range(m + 1)] for _ in range(n + 1)]
    best[0][0] = (0.0, None)
    for i in range(n + 1):
        for j in range(m + 1):
            cost, _ = best[i][j]
            if cost == float("inf"):
                continue
            for take_expected in range(1, min(3, n - i) + 1):
                for take_actual in range(1, min(3, m - j) + 1):
                    left = "".join(expected[i:i + take_expected])
                    right = "".join(item[0] for item in actual[j:j + take_actual])
                    mismatch = edit_distance(left, right) / max(1, len(left), len(right))
                    next_cost = cost + mismatch + 0.08 * (take_expected + take_actual - 2)
                    if next_cost < best[i + take_expected][j + take_actual][0]:
                        best[i + take_expected][j + take_actual] = (
                            next_cost, (i, j, take_expected, take_actual)
                        )

    if best[n][m][0] > 0.35 * max(1, n):
        raise RuntimeError(f"Scene {scene}: word-to-phoneme alignment is uncertain ({best[n][m][0]:.2f}).")
    spans = [None] * n
    i, j = n, m
    while i or j:
        step = best[i][j][1]
        if step is None:
            raise RuntimeError(f"Scene {scene}: could not reconstruct word alignment.")
        prior_i, prior_j, take_expected, take_actual = step
        first_start = groups[prior_j][0]
        final_end = groups[prior_j + take_actual - 1][1]
        for word_index in range(prior_i, prior_i + take_expected):
            spans[word_index] = (first_start, final_end)
        i, j = prior_i, prior_j
    return spans


def main() -> None:
    parts = sections()
    if len(parts) != 7:
        raise SystemExit(f"Expected seven narration sections; found {len(parts)}.")
    model = MODEL_DIR / "kokoro-v1.0.onnx"
    voices = MODEL_DIR / "voices-v1.0.bin"
    if not model.is_file() or not voices.is_file():
        raise SystemExit(f"Kokoro model files are missing from {MODEL_DIR}; run setup-kokoro.ps1 first.")

    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    engine = Kokoro(str(model), str(voices))
    scene_events = []
    for index, source in enumerate(parts, 1):
        source_words = list(TOKEN.finditer(source))
        spoken = TOKEN.sub(lambda match: PRONUNCIATIONS.get(match.group(), match.group()), source)
        spoken_words = list(TOKEN.finditer(spoken))
        phonemes = engine.tokenizer.phonemize(spoken, "en-us")
        samples, sample_rate, timings = engine.create_timed(
            spoken, voice=VOICE, speed=SPEED, lang="en-us"
        )
        word_times = phoneme_word_times(engine, timings, phonemes, spoken_words, index)

        events = []
        speech_index = 0
        for source_word in source_words:
            spoken_form = PRONUNCIATIONS.get(source_word.group(), source_word.group())
            spoken_count = len(TOKEN.findall(spoken_form))
            first = word_times[speech_index]
            last = word_times[speech_index + spoken_count - 1]
            events.append({
                "characterPosition": source_word.start(),
                "characterCount": source_word.end() - source_word.start(),
                "audioPositionSeconds": first[0],
                "audioEndSeconds": last[1],
            })
            speech_index += spoken_count

        path = AUDIO_DIR / f"scene-{index:02d}.wav"
        sf.write(path, samples, sample_rate, subtype="PCM_16")
        scene_events.append({"events": events})
        print(f"Scene {index}: {len(source_words)} words, {len(samples) / sample_rate:.2f}s")

    manifest = {
        "engine": "Kokoro-82M v1.0 / kokoro-onnx 0.6.1",
        "voice": VOICE,
        "speed": SPEED,
        "rate": 24000,
        "scenes": scene_events,
    }
    (AUDIO_DIR / "speech-timings.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
