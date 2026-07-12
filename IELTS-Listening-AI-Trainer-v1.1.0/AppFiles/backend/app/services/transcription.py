import ipaddress
import hashlib
import logging
import mimetypes
import os
import platform
import socket
import tempfile
import threading
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urljoin, urlparse

import requests

from app.services.segmentation import segments_to_sentences, split_sentences, validate_sentence_timeline

logger = logging.getLogger(__name__)
_model = None
_model_key: Optional[Tuple[str, Optional[str]]] = None
_model_lock = threading.Lock()
_transcription_lock = threading.Lock()
_model_download_lock = threading.Lock()
_model_validation_cache = None
MAX_URL_AUDIO_BYTES = 500 * 1024 * 1024
WHISPER_SAMPLE_RATE = 16000
AUDIO_CACHE_DIR = Path(os.environ.get("IELTS_AUDIO_CACHE_DIR") or Path.home() / ".cache" / "ielts-listening-ai" / "audio")
SETTINGS_DIR = Path(os.environ.get("IELTS_SETTINGS_DIR") or Path.home() / ".config" / "ielts-listening-ai")
SELECTED_MODEL_FILE = SETTINGS_DIR / "selected-model"
SUPPORTED_MODELS = ("tiny", "base", "small", "medium")


def selected_model_name() -> str:
    explicit = os.environ.get("WHISPER_MODEL")
    if explicit in SUPPORTED_MODELS:
        return explicit
    try:
        stored = SELECTED_MODEL_FILE.read_text(encoding="utf-8").strip()
        if stored in SUPPORTED_MODELS:
            return stored
    except OSError:
        pass
    return "base"


def configured_model_path(model_name: Optional[str] = None) -> Path:
    selected = model_name or selected_model_name()
    download_root = Path(os.environ.get("WHISPER_CACHE_DIR") or Path.home() / ".cache" / "whisper")
    return download_root / f"{selected}.pt"


def model_file_is_valid(model_name: Optional[str] = None) -> bool:
    global _model_validation_cache
    selected = model_name or selected_model_name()
    path = configured_model_path(selected)
    if not path.is_file():
        return False
    signature = (str(path), path.stat().st_size, path.stat().st_mtime_ns)
    if _model_validation_cache and _model_validation_cache[0] == signature:
        return bool(_model_validation_cache[1])
    try:
        import whisper  # type: ignore

        expected = whisper._MODELS[selected].split("/")[-2]
        digest = hashlib.sha256()
        with path.open("rb") as model_file:
            for chunk in iter(lambda: model_file.read(1024 * 1024), b""):
                digest.update(chunk)
        valid = digest.hexdigest() == expected
    except Exception:
        valid = False
    _model_validation_cache = (signature, valid)
    return valid


def engine_status():
    model_name = selected_model_name()
    model_path = configured_model_path(model_name)
    return {
        "status": "ok",
        "engine": "openai-whisper-local",
        "modelName": model_name,
        "modelAvailable": bool(_model is not None or model_file_is_valid(model_name)),
        "alignmentEngine": "whisper-word-timestamps",
        "modelSize": model_path.stat().st_size if model_path.is_file() else 0,
        "pythonVersion": platform.python_version(),
    }


def list_local_models():
    selected = selected_model_name()
    return [
        {
            "name": name,
            "installed": model_file_is_valid(name),
            "size": configured_model_path(name).stat().st_size if configured_model_path(name).is_file() else 0,
            "selected": name == selected,
        }
        for name in SUPPORTED_MODELS
    ]


def download_local_model(model_name: str):
    if model_name not in SUPPORTED_MODELS:
        raise RuntimeError("Unsupported transcription model")
    if not _model_download_lock.acquire(blocking=False):
        raise RuntimeError("Another transcription model download is already in progress")
    try:
        import whisper  # type: ignore

        download_root = str(configured_model_path(model_name).parent)
        whisper.load_model(model_name, download_root=download_root)
        if not model_file_is_valid(model_name):
            raise RuntimeError("Model download completed but integrity verification failed")
        return next(item for item in list_local_models() if item["name"] == model_name)
    finally:
        _model_download_lock.release()


def select_local_model(model_name: str):
    global _model, _model_key
    if model_name not in SUPPORTED_MODELS:
        raise RuntimeError("Unsupported transcription model")
    if not model_file_is_valid(model_name):
        raise RuntimeError(f"Local Whisper model '{model_name}' is missing or incomplete")
    with _model_lock:
        _model = None
        _model_key = None
        SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
        SELECTED_MODEL_FILE.write_text(model_name, encoding="utf-8")
    return engine_status()


def delete_local_model(model_name: str):
    global _model, _model_key, _model_validation_cache
    if model_name not in SUPPORTED_MODELS:
        raise RuntimeError("Unsupported transcription model")
    if selected_model_name() == model_name:
        raise RuntimeError("The active transcription model cannot be deleted. Switch to another installed model first.")
    path = configured_model_path(model_name)
    with _model_lock:
        if path.is_file():
            path.unlink()
        _model_validation_cache = None
    return {"name": model_name, "deleted": not path.exists()}


def audio_cache_usage():
    if not AUDIO_CACHE_DIR.exists():
        return {"files": 0, "bytes": 0}
    files = [path for path in AUDIO_CACHE_DIR.iterdir() if path.is_file()]
    return {"files": len(files), "bytes": sum(path.stat().st_size for path in files)}


def clear_server_audio_cache():
    usage = audio_cache_usage()
    if AUDIO_CACHE_DIR.exists():
        for path in AUDIO_CACHE_DIR.iterdir():
            if path.is_file():
                path.unlink()
    return {"clearedFiles": usage["files"], "clearedBytes": usage["bytes"]}


def ensure_ffmpeg_on_path() -> None:
    import os
    import imageio_ffmpeg

    ffmpeg_path = Path(imageio_ffmpeg.get_ffmpeg_exe())
    alias_dir = Path(tempfile.gettempdir()) / "ielts-listening-ffmpeg"
    alias_dir.mkdir(parents=True, exist_ok=True)
    alias_path = alias_dir / "ffmpeg"
    if os.path.lexists(alias_path):
        try:
            if alias_path.resolve() != ffmpeg_path.resolve():
                alias_path.unlink()
        except OSError:
            alias_path.unlink()
    if not os.path.lexists(alias_path):
        try:
            alias_path.symlink_to(ffmpeg_path)
        except FileExistsError:
            pass
    os.environ["PATH"] = f"{alias_dir}:{ffmpeg_path.parent}:{os.environ.get('PATH', '')}"


def get_whisper_model():
    global _model, _model_key
    import whisper  # type: ignore

    model_name = selected_model_name()
    download_root = os.environ.get("WHISPER_CACHE_DIR")
    key = (model_name, download_root)
    with _model_lock:
        if _model is None or _model_key != key:
            if not model_file_is_valid(model_name):
                raise RuntimeError(
                    f"Local Whisper model '{model_name}' is not installed or is incomplete. "
                    "Run scripts/download-models.command, then retry."
                )
            _model = whisper.load_model(model_name, download_root=download_root)
            _model_key = key
    return _model


def validate_public_audio_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise RuntimeError("Only public HTTP or HTTPS audio URLs are supported")
    if parsed.username or parsed.password:
        raise RuntimeError("Audio URLs containing embedded credentials are not supported")
    try:
        default_port = 443 if parsed.scheme == "https" else 80
        addresses = {item[4][0] for item in socket.getaddrinfo(parsed.hostname, parsed.port or default_port, type=socket.SOCK_STREAM)}
    except OSError as exc:
        raise RuntimeError("The audio URL host could not be resolved") from exc
    for address in addresses:
        ip = ipaddress.ip_address(address)
        if not ip.is_global:
            raise RuntimeError("Private or local network URLs are not supported")


def cache_audio_payload(payload: bytes, source_name: str) -> str:
    audio_id = hashlib.sha256(payload).hexdigest()
    suffix = Path(source_name).suffix.lower()
    if suffix not in {".mp3", ".wav", ".m4a", ".mp4", ".aac", ".aiff", ".flac", ".ogg"}:
        suffix = ".audio"
    AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = AUDIO_CACHE_DIR / f"{audio_id}{suffix}"
    if not path.exists():
        path.write_bytes(payload)
    return audio_id


def get_cached_audio_path(audio_id: str) -> Optional[Path]:
    if len(audio_id) != 64 or any(character not in "0123456789abcdef" for character in audio_id.lower()):
        return None
    if not AUDIO_CACHE_DIR.exists():
        return None
    return next((path for path in AUDIO_CACHE_DIR.glob(f"{audio_id}.*") if path.is_file()), None)


def transcribe_bytes(payload: bytes, source_name: str):
    try:
        ensure_ffmpeg_on_path()
        import whisper  # type: ignore

        with tempfile.NamedTemporaryFile(suffix=Path(source_name).suffix or ".mp3") as tmp:
            tmp.write(payload)
            tmp.flush()
            model = get_whisper_model()
            audio = whisper.load_audio(tmp.name)
            duration = float(len(audio)) / WHISPER_SAMPLE_RATE
            transcribe_options = {"word_timestamps": True}
            if str(getattr(model, "device", "")).startswith("cpu"):
                transcribe_options["fp16"] = False
            with _transcription_lock:
                output = model.transcribe(audio, **transcribe_options)
            transcript = str(output.get("text", "")).strip()
            segments = output.get("segments") or []
            sentences = segments_to_sentences(segments, duration) if segments else split_sentences(transcript)
            if transcript:
                aligned_word_count = sum(len(sentence.get("words") or []) for sentence in sentences)
                if aligned_word_count:
                    validate_sentence_timeline(sentences, duration)
                model_name = selected_model_name()
                suffix = Path(source_name).suffix.lower().lstrip(".") or "unknown"
                return {
                    "transcript": transcript,
                    "sentences": sentences,
                    "sourceName": source_name,
                    "audio": {
                        "duration": round(duration, 3),
                        "codec": suffix,
                        "sampleRate": WHISPER_SAMPLE_RATE,
                        "mimeType": mimetypes.guess_type(source_name)[0] or "audio/unknown",
                        "size": len(payload),
                    },
                    "transcription": {
                        "status": "ready",
                        "modelName": model_name,
                        "language": output.get("language"),
                    },
                    "alignment": {
                        "status": "ready" if aligned_word_count else "unavailable",
                        "engine": "whisper-word-timestamps",
                        "wordCount": aligned_word_count,
                    },
                }
    except Exception as exc:
        logger.exception("Local Whisper transcription failed")
        raise RuntimeError(f"Local Whisper transcription failed: {exc}") from exc
    raise RuntimeError("Local Whisper returned an empty transcript")


def transcribe_url(url: str):
    try:
        current_url = url
        response = None
        for _ in range(5):
            validate_public_audio_url(current_url)
            candidate = requests.get(
                current_url,
                timeout=(10, 60),
                stream=True,
                allow_redirects=False,
                headers={"User-Agent": "IELTS-Listening-Trainer/2"},
            )
            if candidate.status_code in {301, 302, 303, 307, 308}:
                location = candidate.headers.get("location")
                candidate.close()
                if not location:
                    raise RuntimeError("The audio URL redirected without a destination")
                current_url = urljoin(current_url, location)
                continue
            response = candidate
            break
        if response is None:
            raise RuntimeError("The audio URL redirected too many times")
        with response:
            response.raise_for_status()
            content_length = response.headers.get("content-length")
            if content_length and content_length.isdigit() and int(content_length) > MAX_URL_AUDIO_BYTES:
                raise RuntimeError("URL audio must be 500 MB or smaller")
            content_type = response.headers.get("content-type", "").split(";", 1)[0].lower()
            source_name = Path(urlparse(current_url).path).name or "imported-audio.mp3"
            if not content_type.startswith("audio/") and Path(source_name).suffix.lower() not in {".mp3", ".wav", ".m4a", ".mp4", ".aac", ".aiff", ".flac", ".ogg"}:
                raise RuntimeError("The URL does not point to a supported audio file")
            payload = bytearray()
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                payload.extend(chunk)
                if len(payload) > MAX_URL_AUDIO_BYTES:
                    raise RuntimeError("URL audio must be 500 MB or smaller")
        if not payload:
            raise RuntimeError("The URL returned an empty audio file")
        audio_bytes = bytes(payload)
        audio_id = cache_audio_payload(audio_bytes, source_name)
        return transcribe_bytes(audio_bytes, source_name) | {"sourceUrl": url, "audioId": audio_id}
    except Exception as exc:
        if isinstance(exc, RuntimeError):
            raise
        raise RuntimeError("URL audio could not be downloaded or transcribed") from exc
