import unittest
import os
import tempfile
from pathlib import Path
from unittest import mock

from app.services.scoring import score_answer
from app.services.segmentation import segments_to_sentences, validate_sentence_timeline, words_to_sentences
from app.services import transcription
from app.services.transcription import validate_public_audio_url


class SegmentationTests(unittest.TestCase):
    def test_word_aligned_sentences_have_stable_non_overlapping_boundaries(self):
        words = [
            {"word": "Good", "start": 0.20, "end": 0.48, "probability": 0.98},
            {"word": "morning.", "start": 0.52, "end": 1.02, "probability": 0.97},
            {"word": "Welcome", "start": 1.24, "end": 1.62, "probability": 0.96},
            {"word": "home.", "start": 1.66, "end": 2.10, "probability": 0.95},
        ]

        sentences = words_to_sentences(words, audio_duration=2.2)

        self.assertEqual(len(sentences), 2)
        self.assertLessEqual(sentences[0]["start"], words[0]["start"])
        self.assertGreaterEqual(sentences[0]["end"], words[1]["end"])
        self.assertLessEqual(sentences[0]["end"], sentences[1]["start"])
        self.assertGreaterEqual(sentences[1]["end"], words[-1]["end"])
        self.assertLessEqual(sentences[1]["end"], 2.2)
        self.assertEqual(sentences[0]["words"][0]["id"], "s1-w1")
        self.assertAlmostEqual(sentences[0]["words"][0]["confidence"], 0.98)

    def test_repeated_segmentation_does_not_accumulate_drift(self):
        words = [
            {"word": "Sentence", "start": 2.0, "end": 2.4},
            {"word": "one.", "start": 2.45, "end": 2.9},
            {"word": "Sentence", "start": 3.2, "end": 3.6},
            {"word": "two.", "start": 3.65, "end": 4.1},
        ]
        first = words_to_sentences(words, audio_duration=4.3)
        second = words_to_sentences(words, audio_duration=4.3)
        self.assertEqual(first, second)

    def test_invalid_timing_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_sentence_timeline([{"id": "s1", "text": "Broken", "start": 2.0, "end": 1.0, "words": []}], audio_duration=3.0)

    def test_overlapping_sentences_are_rejected(self):
        with self.assertRaises(ValueError):
            validate_sentence_timeline([
                {"id": "s1", "text": "One", "start": 0.0, "end": 1.2, "words": []},
                {"id": "s2", "text": "Two", "start": 1.0, "end": 2.0, "words": []},
            ], audio_duration=2.1)

    def test_overlapping_aligned_words_are_clamped_to_one_stable_boundary(self):
        words = [
            {"word": "First.", "start": 0.1, "end": 1.1},
            {"word": "Second", "start": 1.0, "end": 1.5},
            {"word": "sentence.", "start": 1.5, "end": 2.0},
        ]
        sentences = words_to_sentences(words, audio_duration=2.1)
        self.assertEqual(len(sentences), 2)
        first_end = sentences[0]["words"][-1]["end"]
        second_start = sentences[1]["words"][0]["start"]
        self.assertEqual(first_end, second_start)
        self.assertLessEqual(sentences[0]["end"], sentences[1]["start"])
        validate_sentence_timeline(sentences, 2.1)

    def test_invalid_word_alignment_falls_back_to_real_segment_timing(self):
        segments = [
            {
                "text": "A valid transcript sentence.",
                "start": 0.2,
                "end": 1.8,
                "words": [{"word": "broken", "start": 0.8, "end": 0.8}],
            }
        ]
        sentences = segments_to_sentences(segments, audio_duration=2.0)
        self.assertEqual(sentences, [{"id": "s1", "text": "A valid transcript sentence.", "start": 0.2, "end": 1.8}])


class ServiceTests(unittest.TestCase):
    def test_exact_answer_scores_100(self):
        result = score_answer("The library opens at nine.", "The library opens at nine")
        self.assertEqual(result["score"], 100)

    def test_private_url_is_rejected(self):
        with self.assertRaises(RuntimeError):
            validate_public_audio_url("http://127.0.0.1/audio.mp3")

    def test_url_credentials_are_rejected(self):
        with self.assertRaises(RuntimeError):
            validate_public_audio_url("https://user:secret@example.com/audio.mp3")

    def test_selected_model_is_restored_from_local_configuration(self):
        original = transcription.SELECTED_MODEL_FILE
        try:
            with tempfile.TemporaryDirectory() as directory, mock.patch.dict(os.environ, {}, clear=False):
                os.environ.pop("WHISPER_MODEL", None)
                transcription.SELECTED_MODEL_FILE = Path(directory) / "selected-model"
                transcription.SELECTED_MODEL_FILE.write_text("small", encoding="utf-8")
                self.assertEqual(transcription.selected_model_name(), "small")
                os.environ["WHISPER_MODEL"] = "tiny"
                self.assertEqual(transcription.selected_model_name(), "tiny")
        finally:
            transcription.SELECTED_MODEL_FILE = original
            os.environ.pop("WHISPER_MODEL", None)

    def test_active_model_cannot_be_deleted(self):
        with mock.patch.object(transcription, "selected_model_name", return_value="tiny"):
            with self.assertRaisesRegex(RuntimeError, "active transcription model"):
                transcription.delete_local_model("tiny")

    def test_concurrent_model_download_is_rejected(self):
        transcription._model_download_lock.acquire()
        try:
            with self.assertRaisesRegex(RuntimeError, "already in progress"):
                transcription.download_local_model("tiny")
        finally:
            transcription._model_download_lock.release()


if __name__ == "__main__":
    unittest.main()
