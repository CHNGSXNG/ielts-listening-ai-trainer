import tempfile
import os
from pathlib import Path

import requests

from app.services.segmentation import segments_to_sentences, split_sentences


def ensure_ffmpeg_on_path() -> None:
    import os
    import imageio_ffmpeg

    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe())
    alias_dir = Path(tempfile.gettempdir()) / "ielts-listening-ffmpeg"
    alias_dir.mkdir(exist_ok=True)
    alias_path = alias_dir / "ffmpeg"
    if not alias_path.exists():
      alias_path.symlink_to(ffmpeg_path)
    os.environ["PATH"] = f"{alias_dir}:{ffmpeg_path.parent}:{os.environ.get('PATH', '')}"


def transcribe_bytes(payload: bytes, source_name: str):
    try:
        import whisper  # type: ignore

        ensure_ffmpeg_on_path()

        with tempfile.NamedTemporaryFile(suffix=Path(source_name).suffix or ".mp3") as tmp:
            tmp.write(payload)
            tmp.flush()
            model_name = os.environ.get("WHISPER_MODEL", "base")
            download_root = os.environ.get("WHISPER_CACHE_DIR")
            model = whisper.load_model(model_name, download_root=download_root)
            output = model.transcribe(tmp.name, word_timestamps=True)
            transcript = str(output.get("text", "")).strip()
            segments = output.get("segments") or []
            sentences = segments_to_sentences(segments) if segments else split_sentences(transcript)
            if transcript:
                return {
                    "transcript": transcript,
                    "sentences": sentences,
                    "sourceName": source_name,
                }
    except Exception as exc:
        raise RuntimeError("Local Whisper transcription is unavailable") from exc
    raise RuntimeError("Local Whisper returned an empty transcript")


def transcribe_url(url: str):
    try:
        response = requests.get(url, timeout=20)
        response.raise_for_status()
        source_name = Path(url.split("?")[0]).name or "Imported URL"
        return transcribe_bytes(response.content, source_name) | {"sourceUrl": url}
    except Exception as exc:
        raise RuntimeError("URL audio could not be downloaded or transcribed") from exc
