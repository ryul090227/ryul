import wave
import numpy as np


class VoiceAnalyzer:
    """WAV 파일에서 목소리 안정성(진폭 분산·영교차율)을 분석한다."""

    CHUNK_DURATION = 0.10   # 에너지 계산 창 크기 (초)
    SILENCE_FACTOR = 0.10   # 평균 에너지의 몇 배 이하면 무음으로 처리

    def analyze(self, audio_path: str) -> dict:
        try:
            with wave.open(audio_path, "r") as wf:
                n_frames = wf.getnframes()
                rate = wf.getframerate()
                channels = wf.getnchannels()
                sample_width = wf.getsampwidth()
                raw = wf.readframes(n_frames)
        except Exception as e:
            return self._empty(str(e))

        dtype = {1: np.uint8, 2: np.int16, 4: np.int32}.get(sample_width, np.int16)
        data = np.frombuffer(raw, dtype=dtype).astype(float)

        if channels == 2:
            data = data[::2]

        peak = np.max(np.abs(data))
        if peak == 0:
            return self._empty("음성 신호가 없습니다.")
        data /= peak

        chunk = int(rate * self.CHUNK_DURATION)
        energies = np.array([
            np.sqrt(np.mean(data[i:i + chunk] ** 2))
            for i in range(0, len(data) - chunk, chunk)
        ])

        if len(energies) < 5:
            return self._empty("음성 데이터가 너무 짧습니다.")

        threshold = np.mean(energies) * self.SILENCE_FACTOR
        speech_e = energies[energies > threshold]

        if len(speech_e) < 5:
            return self._empty("유효한 음성 구간이 부족합니다.")

        mean_e = np.mean(speech_e)
        std_e = np.std(speech_e)
        cv = std_e / mean_e if mean_e > 0 else 1.0

        # 영교차율(ZCR) 기반 피치 안정성
        small = int(rate * 0.025)
        zcr_vals = []
        for i in range(0, len(data) - small, small):
            seg = data[i:i + small]
            if np.sqrt(np.mean(seg ** 2)) > 0.01:
                zcr_vals.append(np.sum(np.diff(np.sign(seg)) != 0) / len(seg))

        if zcr_vals:
            zcr_mean = np.mean(zcr_vals)
            zcr_cv = np.std(zcr_vals) / max(zcr_mean, 0.001)
        else:
            zcr_cv = 0.5

        amp_score = max(0.0, min(100.0, (1 - cv / 0.8) * 100))
        pitch_score = max(0.0, min(100.0, (1 - zcr_cv / 0.5) * 100))
        stability_score = round(0.6 * amp_score + 0.4 * pitch_score)

        return {
            "stability_score": stability_score,
            "amplitude_stability": round(amp_score),
            "pitch_stability": round(pitch_score),
            "cv": round(float(cv), 3),
            "avg_volume": round(float(mean_e) * 100, 1),
            "error": None,
        }

    def _empty(self, msg: str) -> dict:
        return {
            "stability_score": 50,
            "amplitude_stability": 50,
            "pitch_stability": 50,
            "cv": 0.5,
            "avg_volume": 0,
            "error": msg,
        }
