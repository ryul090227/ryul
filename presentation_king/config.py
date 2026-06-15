import os

# 말버릇 단어 목록
FILLER_WORDS = [
    "아", "음", "어", "그", "뭐", "이", "저",
    "그니까", "그러니까", "있잖아", "막", "진짜", "좀", "약간", "뭐냐"
]

# 적정 말 속도 (어절/분)
IDEAL_WPM_MIN = 130
IDEAL_WPM_MAX = 170

# 점수 가중치
SCORE_WEIGHTS = {
    "gaze": 0.30,
    "speech_speed": 0.25,
    "filler": 0.25,
    "voice": 0.20,
}

# 세션 저장 파일
SESSION_FILE = os.path.join(os.path.expanduser("~"), ".presentation_king_sessions.json")

# UI 색상 테마
COLORS = {
    "bg_dark": "#1a1a2e",
    "bg_card": "#16213e",
    "bg_btn": "#0f3460",
    "accent": "#e94560",
    "success": "#00ff88",
    "warning": "#ffa500",
    "text": "#ffffff",
    "text_muted": "#a8a8b3",
}
