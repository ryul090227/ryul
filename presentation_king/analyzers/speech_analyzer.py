import re
import speech_recognition as sr
from config import FILLER_WORDS, IDEAL_WPM_MIN, IDEAL_WPM_MAX


class SpeechAnalyzer:
    def __init__(self):
        self.recognizer = sr.Recognizer()

    def analyze_audio(self, audio_path: str, duration_seconds: float) -> dict:
        """WAV 파일을 STT로 변환한 뒤 말 속도·말버릇을 분석한다."""
        try:
            with sr.AudioFile(audio_path) as source:
                audio = self.recognizer.record(source)
            text = self.recognizer.recognize_google(audio, language="ko-KR")
            return self._analyze_text(text, duration_seconds)
        except sr.UnknownValueError:
            return self._empty_result("음성을 인식할 수 없습니다. 마이크 상태를 확인해주세요.")
        except sr.RequestError:
            return self._empty_result("음성 인식 서비스에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.")
        except Exception as e:
            return self._empty_result(str(e))

    def _analyze_text(self, text: str, duration_seconds: float) -> dict:
        words = text.split()
        word_count = len(words)
        duration_min = max(duration_seconds / 60, 0.01)
        wpm = round(word_count / duration_min)

        filler_details: dict[str, int] = {}
        for fw in FILLER_WORDS:
            if len(fw) == 1:
                cnt = words.count(fw)
            else:
                cnt = len(re.findall(rf'\b{re.escape(fw)}\b', text))
            if cnt > 0:
                filler_details[fw] = cnt

        filler_count = sum(filler_details.values())
        filler_rate = round(filler_count / max(word_count, 1) * 100, 1)

        # 말 속도 점수
        if IDEAL_WPM_MIN <= wpm <= IDEAL_WPM_MAX:
            speech_score = 100
        elif wpm < IDEAL_WPM_MIN:
            ratio = max(wpm - 60, 0) / max(IDEAL_WPM_MIN - 60, 1)
            speech_score = 30 + ratio * 70
        else:
            ratio = max(0, 1 - (wpm - IDEAL_WPM_MAX) / 100)
            speech_score = 30 + ratio * 70

        # 말버릇 점수
        if filler_rate <= 2:
            filler_score = 100
        elif filler_rate <= 5:
            filler_score = 80
        elif filler_rate <= 10:
            filler_score = 60
        elif filler_rate <= 20:
            filler_score = 40
        else:
            filler_score = 20

        return {
            "text": text,
            "word_count": word_count,
            "wpm": wpm,
            "filler_count": filler_count,
            "filler_details": filler_details,
            "filler_rate": filler_rate,
            "speech_score": round(speech_score),
            "filler_score": round(filler_score),
            "error": None,
        }

    def _empty_result(self, error_msg: str) -> dict:
        return {
            "text": "",
            "word_count": 0,
            "wpm": 0,
            "filler_count": 0,
            "filler_details": {},
            "filler_rate": 0.0,
            "speech_score": 50,
            "filler_score": 50,
            "error": error_msg,
        }
