"""
╔══════════════════════════════════════════════════════════╗
║         이제 나도 발표왕 👑  -  Google Colab 버전         ║
║     발표 태도 분석 및 피드백을 통한 발표 태도 개선 프로그램    ║
╚══════════════════════════════════════════════════════════╝
제출 조건 구현 목록:
  ✅ 표준 입력   : input() 함수로 사용자 정보 입력
  ✅ 자료구조    : 리스트 [] 선언 및 데이터 저장·활용
  ✅ 중첩 제어구조: for 안에 for, if 안에 if 중첩
  ✅ 매개변수·반환: def 함수에 매개변수(Parameter) + return 값
"""

# ══════════════════════════════════════════════════════════
# STEP 1 : 패키지 설치
# ══════════════════════════════════════════════════════════
import subprocess
subprocess.run(
    "pip install -q mediapipe opencv-python-headless SpeechRecognition".split()
)
print("✅ 패키지 설치 완료\n")

# ══════════════════════════════════════════════════════════
# STEP 2 : 라이브러리 임포트
# ══════════════════════════════════════════════════════════
import cv2
import mediapipe as mp
import numpy as np
import speech_recognition as sr
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import wave, os

# ══════════════════════════════════════════════════════════
# STEP 3 : 표준 입력 (input 함수)
# ══════════════════════════════════════════════════════════
print("=" * 50)
print("   이제 나도 발표왕 - 발표 태도 분석 프로그램")
print("=" * 50)

user_name  = input("이름(학번)을 입력하세요: ")          # ← input() 활용 ①
pres_topic = input("발표 주제를 입력하세요: ")            # ← input() 활용 ②
extra_raw  = input("추가 말버릇 단어를 입력하세요\n"
                   "(쉼표로 구분, 없으면 그냥 엔터): ")   # ← input() 활용 ③

print(f"\n안녕하세요, {user_name}님! '{pres_topic}' 발표를 분석하겠습니다.\n")

# ══════════════════════════════════════════════════════════
# STEP 4 : 자료구조 - 리스트 선언 및 초기화
# ══════════════════════════════════════════════════════════

# ─ 기본 말버릇 단어 리스트 ─────────────────────────────── ← 리스트 활용 ①
filler_words = ["아", "음", "어", "그", "뭐", "이", "저",
                "그니까", "그러니까", "있잖아", "막", "진짜", "좀", "약간"]

# 사용자가 추가 입력한 단어를 리스트에 추가 ────────────────── ← 리스트 활용 ②
if extra_raw.strip():
    for word in extra_raw.split(","):          # ← for 반복문
        stripped = word.strip()
        if stripped and stripped not in filler_words:   # ← if 조건문 (중첩①)
            filler_words.append(stripped)

print(f"추적 말버릇 단어 목록: {filler_words}\n")

# ─ 분석 데이터 저장용 리스트들 ──────────────────────────── ← 리스트 활용 ③④
gaze_history   = []   # 시선 방향 기록
energy_samples = []   # 오디오 에너지 샘플
session_results = []  # 세션 결과 저장

# ══════════════════════════════════════════════════════════
# STEP 5 : 사용자 함수 정의 (매개변수 + 반환값)
# ══════════════════════════════════════════════════════════

# MediaPipe 랜드마크 인덱스 상수
LEFT_IRIS        = [468, 469, 470, 471, 472]
LEFT_OUTER       = 33
LEFT_INNER       = 133
LEFT_EYE_TOP     = [160, 158]
LEFT_EYE_BOTTOM  = [144, 153]
GAZE_DIRECTIONS  = ['forward', 'left', 'right', 'up', 'down']


def calc_gaze(landmarks):                          # ← 매개변수 활용 ①
    """
    얼굴 랜드마크를 받아 시선 방향 문자열을 반환한다.
    매개변수: landmarks - MediaPipe 얼굴 랜드마크 리스트
    반환값:   'forward' | 'left' | 'right' | 'up' | 'down'
    """
    iris_x = sum(landmarks[i].x for i in LEFT_IRIS) / len(LEFT_IRIS)
    iris_y = sum(landmarks[i].y for i in LEFT_IRIS) / len(LEFT_IRIS)

    eye_width  = abs(landmarks[LEFT_INNER].x - landmarks[LEFT_OUTER].x)
    eye_height = abs(
        max(landmarks[i].y for i in LEFT_EYE_BOTTOM) -
        min(landmarks[i].y for i in LEFT_EYE_TOP)
    )

    h_ratio = (iris_x - landmarks[LEFT_OUTER].x) / eye_width  if eye_width  > 0.001 else 0.5
    v_ratio = (iris_y - min(landmarks[i].y for i in LEFT_EYE_TOP)) / eye_height if eye_height > 0.001 else 0.5

    # ─ 중첩 제어구조 ① : if 안에 elif/else 중첩 ─────────────
    if v_ratio < 0.30:
        return 'up'
    elif v_ratio > 0.72:
        return 'down'
    else:
        if h_ratio < 0.35:        # ← if 중첩 (중첩 제어구조)
            return 'left'
        elif h_ratio > 0.65:
            return 'right'
        else:
            return 'forward'


def analyze_gaze(gaze_list):                       # ← 매개변수 활용 ②
    """
    시선 방향 리스트를 받아 통계와 점수를 반환한다.
    매개변수: gaze_list - 시선 방향 문자열 리스트
    반환값:   (gaze_pct 딕셔너리, forward 비율, 점수)
    """
    total = max(len(gaze_list), 1)
    gaze_pct = {}

    # ─ 중첩 제어구조 ② : for 안에 if ───────────────────────
    for direction in GAZE_DIRECTIONS:
        count = 0
        for g in gaze_list:          # ← for 중첩 (중첩 제어구조)
            if g == direction:
                count += 1
        gaze_pct[direction] = round(count / total * 100, 1)

    fwd = gaze_pct['forward']

    if fwd >= 70:
        score = 100
    elif fwd >= 50:
        score = 70 + (fwd - 50) * 1.5
    elif fwd >= 30:
        score = 40 + (fwd - 30) * 1.5
    else:
        score = fwd * (40 / 30)

    return gaze_pct, fwd, round(score)             # ← 반환값 ①


def analyze_speech(text, duration, words_list):    # ← 매개변수 활용 ③
    """
    인식된 텍스트, 발표 시간, 말버릇 단어 리스트를 받아 분석 결과를 반환한다.
    매개변수: text       - STT 인식 텍스트
              duration   - 발표 시간(초)
              words_list - 추적할 말버릇 단어 리스트
    반환값:   (wpm, filler_details 딕셔너리, filler_count, speech_score, filler_score)
    """
    word_tokens = text.split()
    wc  = len(word_tokens)
    wpm = round(wc / max(duration / 60, 0.01))

    filler_details = {}   # ← 딕셔너리 (리스트와 함께 자료구조 활용)

    # ─ 중첩 제어구조 ③ : for 안에 for 안에 if ───────────────
    for fw in words_list:                          # 말버릇 단어 순회
        count = 0
        for token in word_tokens:                  # ← for 중첩 (중첩 제어구조)
            clean = token.replace(",", "").replace(".", "").replace("?", "")
            if len(fw) <= 2:
                if clean == fw:                    # ← if 중첩 (중첩 제어구조)
                    count += 1
            else:
                if fw in token:
                    count += 1
        if count > 0:
            filler_details[fw] = count

    filler_count = sum(filler_details.values())
    filler_rate  = round(filler_count / max(wc, 1) * 100, 1)

    if 130 <= wpm <= 170:
        speech_score = 100
    elif wpm < 130:
        speech_score = max(30, 30 + max(wpm - 60, 0) / (130 - 60) * 70)
    else:
        speech_score = max(30, 30 + max(0, 1 - (wpm - 170) / 100) * 70)

    if filler_rate <= 2:   filler_score = 100
    elif filler_rate <= 5:  filler_score = 80
    elif filler_rate <= 10: filler_score = 60
    elif filler_rate <= 20: filler_score = 40
    else:                   filler_score = 20

    return wpm, filler_details, filler_count, round(speech_score), filler_score  # ← 반환값 ②


def calc_voice_score(samples):                     # ← 매개변수 활용 ④
    """
    오디오 에너지 샘플 리스트를 받아 목소리 안정성 점수를 반환한다.
    매개변수: samples - float 에너지 값 리스트
    반환값:   0~100 사이 정수 점수
    """
    speech_samples = []

    # ─ 중첩 제어구조 ④ : for 안에 if ───────────────────────
    for e in samples:
        if len(samples) > 0:
            avg_e = sum(samples) / len(samples)
            if e > avg_e * 0.1:               # ← if 중첩 (중첩 제어구조)
                speech_samples.append(e)

    if len(speech_samples) < 5:
        return 50

    mean = sum(speech_samples) / len(speech_samples)
    variance = sum((x - mean) ** 2 for x in speech_samples) / len(speech_samples)
    cv = (variance ** 0.5) / mean if mean > 0 else 1

    return round(max(0, min(100, (1 - cv / 0.8) * 100)))  # ← 반환값 ③


def generate_feedback(gaze_score, fwd_pct, speech_score, wpm,
                      filler_score, filler_count, filler_details,
                      voice_score):                # ← 매개변수 활용 ⑤
    """
    각 점수를 받아 피드백 문자열 리스트와 팁 리스트를 반환한다.
    반환값: (feedback_list, tips_list) — 둘 다 리스트
    """
    feedback_list = []    # ← 리스트 활용 ⑤
    tips_list     = []    # ← 리스트 활용 ⑥

    # 시선 처리 피드백
    if fwd_pct >= 70:
        feedback_list.append(f"👁 시선: 정면 응시 {fwd_pct}%로 매우 훌륭합니다!")
    elif fwd_pct >= 50:
        feedback_list.append(f"👁 시선: 정면 응시 {fwd_pct}%. 청중을 더 바라보세요.")
        tips_list.append("청중을 3~5초 단위로 번갈아 바라보는 연습을 해보세요.")
    else:
        feedback_list.append(f"👁 시선: 정면 응시 {fwd_pct}%로 낮습니다. 카메라를 자주 바라보세요.")
        tips_list.append("발표 자료보다 청중을 먼저 바라보는 습관을 기르세요.")

    # 말 속도 피드백
    if wpm == 0:
        feedback_list.append("🎙 말 속도: 음성이 인식되지 않았습니다.")
    elif 130 <= wpm <= 170:
        feedback_list.append(f"🎙 말 속도: 분당 {wpm}어절로 적절합니다!")
    elif wpm < 130:
        feedback_list.append(f"🎙 말 속도: 분당 {wpm}어절로 느립니다.")
        tips_list.append("적정 속도는 분당 130~170어절입니다. 좀 더 자신감 있게 말해보세요.")
    else:
        feedback_list.append(f"🎙 말 속도: 분당 {wpm}어절로 빠릅니다.")
        tips_list.append("중요한 내용에서 의도적으로 속도를 늦추고 짧은 침묵을 활용하세요.")

    # 말버릇 피드백
    if filler_count == 0:
        feedback_list.append("💬 말버릇: 불필요한 표현 없음. 완벽합니다!")
    elif filler_count <= 5:
        feedback_list.append(f"💬 말버릇: {filler_count}회. 양호한 수준입니다.")
    else:
        top = sorted(filler_details.items(), key=lambda x: x[1], reverse=True)[:3]
        top_str = ", ".join(f"'{k}'({v}회)" for k, v in top)
        feedback_list.append(f"💬 말버릇: {filler_count}회. 특히 {top_str}을 줄이세요.")
        tips_list.append("말이 막힐 때 '아', '음' 대신 짧은 침묵을 유지하세요.")

    # 목소리 안정성 피드백
    if voice_score >= 80:
        feedback_list.append(f"📊 목소리: {voice_score}점으로 매우 안정적입니다!")
    elif voice_score >= 60:
        feedback_list.append(f"📊 목소리: {voice_score}점으로 양호합니다.")
        tips_list.append("발표 전 심호흡 3번으로 목소리를 더욱 안정시키세요.")
    elif voice_score >= 40:
        feedback_list.append(f"📊 목소리: {voice_score}점으로 다소 불안정합니다.")
        tips_list.append("복식호흡으로 말하면 목소리가 훨씬 안정됩니다.")
    else:
        feedback_list.append(f"📊 목소리: {voice_score}점으로 많이 불안정합니다.")
        tips_list.append("매일 5분 복식호흡 발성 연습을 해보세요.")

    return feedback_list, tips_list                # ← 반환값 ④


# ══════════════════════════════════════════════════════════
# STEP 6 : 영상 업로드 (Google Colab)
# ══════════════════════════════════════════════════════════
from google.colab import files as colab_files

print("\n📹 발표 영상 파일을 업로드해 주세요 (MP4, MOV, AVI 등)")
print("   → 스마트폰/웹캠으로 발표하는 모습을 미리 녹화해서 올려주세요")
uploaded = colab_files.upload()

if not uploaded:
    raise SystemExit("❌ 파일이 업로드되지 않았습니다.")

VIDEO_PATH = list(uploaded.keys())[0]
print(f"✅ 업로드 완료: {VIDEO_PATH}")

# 영상 정보 확인
cap          = cv2.VideoCapture(VIDEO_PATH)
FPS          = cap.get(cv2.CAP_PROP_FPS) or 30
TOTAL_FRAMES = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
DURATION     = TOTAL_FRAMES / FPS
cap.release()

m, s = divmod(int(DURATION), 60)
print(f"  영상 길이: {m}분 {s}초\n")

# ══════════════════════════════════════════════════════════
# STEP 7 : 시선 처리 분석
# ══════════════════════════════════════════════════════════
print("👁 시선 처리 분석 중...")

face_mesh  = mp.solutions.face_mesh.FaceMesh(
    max_num_faces=1, refine_landmarks=True,
    min_detection_confidence=0.5, min_tracking_confidence=0.5
)
cap        = cv2.VideoCapture(VIDEO_PATH)
frame_step = max(1, int(FPS // 5))
frame_idx  = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    if frame_idx % frame_step == 0:
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = face_mesh.process(rgb)
        if result.multi_face_landmarks:
            gaze = calc_gaze(result.multi_face_landmarks[0].landmark)
            gaze_history.append(gaze)   # ← 리스트에 데이터 저장
    frame_idx += 1

cap.release()
face_mesh.close()

# 시선 분석 함수 호출 (매개변수 전달 → 반환값 수신)
gaze_pct, fwd_pct, gaze_score = analyze_gaze(gaze_history)
print(f"  정면 응시: {fwd_pct}%  |  시선 점수: {gaze_score}점")

# ══════════════════════════════════════════════════════════
# STEP 8 : 오디오 추출 및 음성 분석
# ══════════════════════════════════════════════════════════
print("\n🎙 음성 분석 중... (Google STT, 인터넷 필요)")

AUDIO_PATH = "speech_audio.wav"
os.system(f'ffmpeg -i "{VIDEO_PATH}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "{AUDIO_PATH}" -y -loglevel quiet')

recognized_text = ""
wpm = filler_count = speech_score = filler_score = 0
filler_details = {}

if os.path.exists(AUDIO_PATH):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(AUDIO_PATH) as src:
            audio_data = recognizer.record(src)
        recognized_text = recognizer.recognize_google(audio_data, language="ko-KR")
        print(f"  인식 텍스트: {recognized_text[:90]}{'...' if len(recognized_text) > 90 else ''}")

        # 음성 분석 함수 호출 (매개변수 전달 → 반환값 수신)
        wpm, filler_details, filler_count, speech_score, filler_score = \
            analyze_speech(recognized_text, DURATION, filler_words)

        print(f"  말 속도: 분당 {wpm}어절  |  말버릇: {filler_count}회")
        print(f"  말속도 점수: {speech_score}점  |  말버릇 점수: {filler_score}점")

    except sr.UnknownValueError:
        print("  ⚠️ 음성을 인식하지 못했습니다. (더 크고 명확하게 말해보세요)")
        speech_score = filler_score = 50
    except sr.RequestError as e:
        print(f"  ⚠️ 인터넷 연결 오류: {e}")
        speech_score = filler_score = 50

# ══════════════════════════════════════════════════════════
# STEP 9 : 목소리 안정성 분석
# ══════════════════════════════════════════════════════════
print("\n📊 목소리 안정성 분석 중...")

voice_score = 50
if os.path.exists(AUDIO_PATH):
    try:
        with wave.open(AUDIO_PATH, 'r') as wf:
            rate = wf.getframerate()
            raw  = wf.readframes(wf.getnframes())
        audio_arr = np.frombuffer(raw, dtype=np.int16).astype(float)
        peak = np.max(np.abs(audio_arr))
        if peak > 0:
            audio_arr /= peak
            chunk_size = int(rate * 0.1)
            # 에너지 샘플을 리스트에 저장 ───────────────── ← 리스트 활용 ④
            for i in range(0, len(audio_arr) - chunk_size, chunk_size):
                chunk = audio_arr[i:i + chunk_size]
                rms   = float(np.sqrt(np.mean(chunk ** 2)))
                energy_samples.append(rms)          # ← 리스트에 데이터 추가

        # 목소리 점수 함수 호출 (매개변수 전달 → 반환값 수신)
        voice_score = calc_voice_score(energy_samples)
        print(f"  목소리 안정성: {voice_score}점")
    except Exception as e:
        print(f"  ⚠️ 오디오 분석 오류: {e}")

# ══════════════════════════════════════════════════════════
# STEP 10 : 종합 점수 계산 및 결과 저장
# ══════════════════════════════════════════════════════════
overall = round(
    gaze_score   * 0.30 +
    speech_score * 0.25 +
    filler_score * 0.25 +
    voice_score  * 0.20
)
grade = ('매우 우수 🌟' if overall >= 90
         else '우수 👍'   if overall >= 80
         else '보통 📈'   if overall >= 60
         else '연습 필요 💪')

# 결과를 딕셔너리로 만들어 session_results 리스트에 저장 ── ← 리스트 활용 ⑦
result_dict = {
    "이름":       user_name,
    "주제":       pres_topic,
    "종합점수":   overall,
    "시선점수":   gaze_score,
    "말속도점수": speech_score,
    "말버릇점수": filler_score,
    "목소리점수": voice_score,
    "정면응시":   fwd_pct,
    "말속도WPM":  wpm,
    "말버릇횟수": filler_count,
}
session_results.append(result_dict)   # ← 리스트에 결과 저장

# 결과 출력
print(f"\n{'='*55}")
print(f"  {user_name}님의 '{pres_topic}' 발표 분석 결과")
print(f"  종합 점수: {overall}점  ({grade})")
print(f"{'='*55}")
print(f"  시선 처리 점수:    {gaze_score}점  (정면 응시 {fwd_pct}%)")
print(f"  말 속도 점수:      {speech_score}점  (분당 {wpm}어절, 적정 130~170)")
print(f"  말버릇 점수:       {filler_score}점  (총 {filler_count}회)")
print(f"  목소리 안정성:     {voice_score}점")
print(f"{'='*55}")

# 피드백 함수 호출 (매개변수 전달 → 반환값 수신)
feedback_list, tips_list = generate_feedback(
    gaze_score, fwd_pct, speech_score, wpm,
    filler_score, filler_count, filler_details, voice_score
)

print("\n📋 분석 피드백:")
for fb in feedback_list:       # ← 리스트 순회
    print(f"  {fb}")

if tips_list:
    print("\n💡 개선 팁:")
    for tip in tips_list:      # ← 리스트 순회
        print(f"  • {tip}")

# ══════════════════════════════════════════════════════════
# STEP 11 : 결과 시각화 (matplotlib)
# ══════════════════════════════════════════════════════════
print("\n📊 결과 차트 생성 중...")

def score_color(s):            # ← 매개변수 활용 ⑥
    """점수에 따라 색상 문자열을 반환한다."""
    if s >= 80:
        return '#00ff88'
    elif s >= 60:
        return '#ffa500'
    else:
        return '#e94560'       # ← 반환값 ⑤

fig = plt.figure(figsize=(14, 9))
fig.patch.set_facecolor('#1a1a2e')
gs  = gridspec.GridSpec(2, 3, figure=fig, hspace=0.50, wspace=0.40)

# ─ 종합 점수 도넛 ─────────────────────────────────────────
ax0 = fig.add_subplot(gs[0, 0])
ax0.set_facecolor('#16213e')
sc  = score_color(overall)
ax0.pie([overall, 100 - overall],
        colors=[sc, '#2a2a4a'],
        startangle=90, wedgeprops={'width': 0.4})
ax0.text(0, 0, f'{overall}점', ha='center', va='center',
         fontsize=22, fontweight='bold', color=sc)
ax0.set_title(f'종합 점수\n{grade}', color='white', fontsize=11, pad=10)

# ─ 항목별 점수 막대 ───────────────────────────────────────
ax1 = fig.add_subplot(gs[0, 1:])
ax1.set_facecolor('#16213e')

# 점수 리스트와 라벨 리스트 활용 ──────────────────────── ← 리스트 활용 ⑧
cat_labels  = ['시선\n처리', '말\n속도', '말\n버릇', '목소리\n안정성']
cat_scores  = [gaze_score, speech_score, filler_score, voice_score]
cat_colors  = [score_color(s) for s in cat_scores]  # ← 리스트 컴프리헨션

bars = ax1.bar(cat_labels, cat_scores, color=cat_colors, width=0.5, zorder=3)
ax1.set_ylim(0, 115)
ax1.tick_params(colors='white', labelsize=10)
ax1.axhline(y=70, color='#ffa500', linestyle='--', alpha=0.5, linewidth=1.2, label='기준선(70점)')
ax1.grid(axis='y', color='#333355', alpha=0.5, zorder=0)
for sp in ['top', 'right']:   ax1.spines[sp].set_visible(False)
for sp in ['bottom', 'left']: ax1.spines[sp].set_color('#444466')
for bar, score in zip(bars, cat_scores):
    ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 2,
             f'{score}점', ha='center', va='bottom',
             color='white', fontsize=10, fontweight='bold')
ax1.legend(facecolor='#16213e', edgecolor='#444466', labelcolor='white', fontsize=9)
ax1.set_title('항목별 점수', color='white', fontsize=12)

# ─ 시선 분포 파이 ─────────────────────────────────────────
ax2 = fig.add_subplot(gs[1, 0])
ax2.set_facecolor('#16213e')
gaze_ko      = {'forward':'정면','left':'왼쪽','right':'오른쪽','up':'위','down':'아래'}
gaze_palette = {'forward':'#00ff88','left':'#ffa500','right':'#ff8020','up':'#ffff44','down':'#e94560'}

# 시선 분포 데이터를 리스트로 정리 ────────────────────── ← 리스트 활용 ⑨
gaze_labels_list = []
gaze_values_list = []
gaze_colors_list = []
for d in GAZE_DIRECTIONS:
    if gaze_pct.get(d, 0) > 0:
        gaze_labels_list.append(gaze_ko[d])
        gaze_values_list.append(gaze_pct[d])
        gaze_colors_list.append(gaze_palette[d])

if gaze_values_list:
    ax2.pie(gaze_values_list, labels=gaze_labels_list, colors=gaze_colors_list,
            autopct='%1.1f%%', startangle=90,
            textprops={'color': 'white', 'fontsize': 8})
ax2.set_title('👁 시선 분포', color='white', fontsize=11)

# ─ 말 속도 막대 ───────────────────────────────────────────
ax3 = fig.add_subplot(gs[1, 1])
ax3.set_facecolor('#16213e')
ax3.bar(['실제\nWPM', '목표\nWPM'], [wpm, 150],
        color=[score_color(speech_score), '#00ff88'])
ax3.tick_params(colors='white', labelsize=9)
for sp in ['top', 'right']:   ax3.spines[sp].set_visible(False)
for sp in ['bottom', 'left']: ax3.spines[sp].set_color('#444466')
ax3.grid(axis='y', color='#333355', alpha=0.5)
ax3.set_title(f'🎙 말 속도\n(분당 {wpm}어절)', color='white', fontsize=10)

# ─ 말버릇 가로 막대 ───────────────────────────────────────
ax4 = fig.add_subplot(gs[1, 2])
ax4.set_facecolor('#16213e')
if filler_details:
    top_fillers = sorted(filler_details.items(), key=lambda x: x[1], reverse=True)[:6]
    fw_keys, fw_vals = zip(*top_fillers)
    ax4.barh(list(fw_keys), list(fw_vals), color='#e94560')
    ax4.tick_params(colors='white', labelsize=9)
    for sp in ['top', 'right']:   ax4.spines[sp].set_visible(False)
    for sp in ['bottom', 'left']: ax4.spines[sp].set_color('#444466')
else:
    ax4.text(0.5, 0.5, '말버릇 없음 ✨',
             ha='center', va='center', color='#00ff88',
             fontsize=13, transform=ax4.transAxes)
ax4.set_title(f'💬 말버릇 (총 {filler_count}회)', color='white', fontsize=10)

plt.suptitle(f'이제 나도 발표왕 👑  |  {user_name}  |  {pres_topic}',
             color='white', fontsize=13, fontweight='bold', y=1.02)
plt.savefig('presentation_result.png', dpi=150,
            bbox_inches='tight', facecolor='#1a1a2e')
plt.show()

# ══════════════════════════════════════════════════════════
# STEP 12 : 최종 요약 출력 및 결과 다운로드
# ══════════════════════════════════════════════════════════
print("\n" + "=" * 55)
print("  ✅ 분석 완료! 저장된 결과 데이터:")
for key, value in session_results[0].items():  # ← 리스트 인덱싱 활용
    print(f"    {key}: {value}")
print("=" * 55)

colab_files.download('presentation_result.png')
print("\n🎉 결과 이미지 다운로드 완료!")
