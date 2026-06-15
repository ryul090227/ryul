import json
import os
from datetime import datetime
from config import SESSION_FILE


def save_session(results: dict) -> dict:
    sessions = load_sessions()
    duration = results.get("duration", 0)

    record = {
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "overall_score": results.get("overall_score", 0),
        "gaze_score": results.get("gaze", {}).get("score", 0),
        "speech_score": results.get("speech", {}).get("speech_score", 0),
        "filler_score": results.get("speech", {}).get("filler_score", 0),
        "voice_score": results.get("voice", {}).get("stability_score", 0),
        "duration": duration,
        "wpm": results.get("speech", {}).get("wpm", 0),
        "filler_count": results.get("speech", {}).get("filler_count", 0),
        "forward_percent": results.get("gaze", {}).get("forward_percent", 0),
    }

    sessions.append(record)
    try:
        with open(SESSION_FILE, "w", encoding="utf-8") as f:
            json.dump(sessions, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[session_manager] 저장 실패: {e}")

    return record


def load_sessions() -> list[dict]:
    if not os.path.exists(SESSION_FILE):
        return []
    try:
        with open(SESSION_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []
