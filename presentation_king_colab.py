"""
이제 나도 발표왕 👑 — Google Colab 버전
셀을 위에서 아래로 순서대로 실행하세요.
발표하는 영상을 미리 녹화해서 업로드하면 분석해 드립니다.
"""

# ════════════════════════════════════════════════════════════
# 1단계: 패키지 설치 (처음 한 번만)
# ════════════════════════════════════════════════════════════
import subprocess
subprocess.run("pip install -q mediapipe opencv-python-headless SpeechRecognition".split())
print("✅ 패키지 설치 완료")

# ════════════════════════════════════════════════════════════
# 2단계: 임포트
# ════════════════════════════════════════════════════════════
import cv2
import mediapipe as mp
import numpy as np
import speech_recognition as sr
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import wave, os, re

print("✅ 라이브러리 로드 완료")

# ════════════════════════════════════════════════════════════
# 3단계: 발표 영상 업로드
# ════════════════════════════════════════════════════════════
from google.colab import files as colab_files

print("\n📹 발표 영상 파일을 업로드해 주세요 (MP4, MOV, AVI 등)")
print("   → 스마트폰 또는 웹캠으로 발표하는 모습을 미리 녹화해 올려주세요")
uploaded = colab_files.upload()

if not uploaded:
    raise SystemExit("❌ 파일이 업로드되지 않았습니다.")

VIDEO_PATH = list(uploaded.keys())[0]
print(f"✅ 업로드 완료: {VIDEO_PATH}")

# ════════════════════════════════════════════════════════════
# 4단계: 영상 정보 확인
# ════════════════════════════════════════════════════════════
cap = cv2.VideoCapture(VIDEO_PATH)
FPS          = cap.get(cv2.CAP_PROP_FPS) or 30
TOTAL_FRAMES = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
DURATION     = TOTAL_FRAMES / FPS
cap.release()

m, s = divmod(int(DURATION), 60)
print(f"  영상 길이: {m}분 {s}초 | FPS: {FPS:.1f}")

# ════════════════════════════════════════════════════════════
# 5단계: 시선 처리 분석 (MediaPipe Face Mesh)
# ════════════════════════════════════════════════════════════
print("\n👁 시선 처리 분석 중... (잠시 기다려 주세요)")

LEFT_IRIS = [468, 469, 470, 471, 472]
L_OUT, L_IN = 33, 133
L_TOP, L_BOT = [160, 158], [144, 153]

def calc_gaze(lm):
    avg_x = lambda idx: sum(lm[i].x for i in idx) / len(idx)
    avg_y = lambda idx: sum(lm[i].y for i in idx) / len(idx)
    ix, iy = avg_x(LEFT_IRIS), avg_y(LEFT_IRIS)
    ew = abs(lm[L_IN].x - lm[L_OUT].x)
    eh = abs(max(lm[i].y for i in L_BOT) - min(lm[i].y for i in L_TOP))
    hr = (ix - lm[L_OUT].x) / ew if ew > 0.001 else 0.5
    vr = (iy - min(lm[i].y for i in L_TOP)) / eh if eh > 0.001 else 0.5
    if vr < 0.30: return 'up'
    if vr > 0.72: return 'down'
    if hr < 0.35: return 'left'
    if hr > 0.65: return 'right'
    return 'forward'

face_mesh = mp.solutions.face_mesh.FaceMesh(
    max_num_faces=1, refine_landmarks=True,
    min_detection_confidence=0.5, min_tracking_confidence=0.5
)

cap        = cv2.VideoCapture(VIDEO_PATH)
gaze_hist  = []
frame_step = max(1, int(FPS // 5))   # 초당 5프레임만 분석
idx        = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break
    if idx % frame_step == 0:
        rgb    = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = face_mesh.process(rgb)
        if result.multi_face_landmarks:
            gaze_hist.append(calc_gaze(result.multi_face_landmarks[0].landmark))
    idx += 1

cap.release()
face_mesh.close()

dirs      = ['forward', 'left', 'right', 'up', 'down']
n         = max(len(gaze_hist), 1)
gaze_pct  = {d: round(gaze_hist.count(d) / n * 100, 1) for d in dirs}
fwd       = gaze_pct['forward']
gaze_score = (100 if fwd >= 70
              else 70 + (fwd - 50) * 1.5 if fwd >= 50
              else 40 + (fwd - 30) * 1.5 if fwd >= 30
              else fwd * (40 / 30))
gaze_score = round(gaze_score)
print(f"  ✅ 정면 응시 비율: {fwd}%  |  시선 점수: {gaze_score}점")

# ════════════════════════════════════════════════════════════
# 6단계: 오디오 추출 (ffmpeg — Colab 기본 제공)
# ════════════════════════════════════════════════════════════
AUDIO_PATH = "speech_audio.wav"
os.system(f'ffmpeg -i "{VIDEO_PATH}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "{AUDIO_PATH}" -y -loglevel quiet')
print(f"\n🎵 오디오 추출 {'완료' if os.path.exists(AUDIO_PATH) else '실패'}")

# ════════════════════════════════════════════════════════════
# 7단계: 음성 인식 + 말 속도 + 말버릇 분석
# ════════════════════════════════════════════════════════════
print("🎙 음성 분석 중... (Google STT — 인터넷 필요)")

FILLER_WORDS = ["아","음","어","그","뭐","이","저",
                "그니까","그러니까","있잖아","막","진짜","좀","약간"]

text = ""
word_count = wpm = filler_count = 0
filler_details: dict = {}
speech_score = filler_score = 50

if os.path.exists(AUDIO_PATH):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(AUDIO_PATH) as src:
            audio = recognizer.record(src)
        text = recognizer.recognize_google(audio, language="ko-KR")
        print(f"  인식된 텍스트: {text[:100]}{'...' if len(text) > 100 else ''}")

        words      = text.split()
        word_count = len(words)
        wpm        = round(word_count / max(DURATION / 60, 0.01))
        filler_rate_per_100 = 0

        for fw in FILLER_WORDS:
            c = (words.count(fw) if len(fw) <= 2
                 else sum(1 for w in words if fw in w))
            if c > 0:
                filler_details[fw] = c

        filler_count        = sum(filler_details.values())
        filler_rate_per_100 = round(filler_count / max(word_count, 1) * 100, 1)

        speech_score = (100 if 130 <= wpm <= 170
                        else max(30, 30 + max(wpm - 60, 0) / (130 - 60) * 70) if wpm < 130
                        else max(30, 30 + max(0, 1 - (wpm - 170) / 100) * 70))
        filler_score = (100 if filler_rate_per_100 <= 2
                        else 80 if filler_rate_per_100 <= 5
                        else 60 if filler_rate_per_100 <= 10
                        else 40 if filler_rate_per_100 <= 20
                        else 20)
        speech_score, filler_score = round(speech_score), round(filler_score)

        print(f"  말 속도: 분당 {wpm}어절  |  말버릇: {filler_count}회  |  점수: 말속도 {speech_score}점 / 말버릇 {filler_score}점")

    except sr.UnknownValueError:
        print("  ⚠️ 음성을 인식하지 못했습니다. (발음을 더 명확히 해보세요)")
    except sr.RequestError as e:
        print(f"  ⚠️ 인터넷 연결 오류: {e}")

# ════════════════════════════════════════════════════════════
# 8단계: 목소리 안정성 분석
# ════════════════════════════════════════════════════════════
print("\n📊 목소리 안정성 분석 중...")

voice_score = 50
if os.path.exists(AUDIO_PATH):
    try:
        with wave.open(AUDIO_PATH, 'r') as wf:
            rate = wf.getframerate()
            raw  = wf.readframes(wf.getnframes())
        data = np.frombuffer(raw, dtype=np.int16).astype(float)
        peak = np.max(np.abs(data))
        if peak > 0:
            data /= peak
            chunk    = int(rate * 0.1)   # 100ms 단위
            energies = np.array([
                np.sqrt(np.mean(data[i:i + chunk] ** 2))
                for i in range(0, len(data) - chunk, chunk)
            ])
            speech_e = energies[energies > np.mean(energies) * 0.1]
            if len(speech_e) >= 5:
                m  = np.mean(speech_e)
                cv = np.std(speech_e) / m if m > 0 else 1
                voice_score = round(max(0, min(100, (1 - cv / 0.8) * 100)))
        print(f"  ✅ 목소리 안정성: {voice_score}점")
    except Exception as e:
        print(f"  ⚠️ 오디오 분석 오류: {e}")

# ════════════════════════════════════════════════════════════
# 9단계: 종합 점수 및 피드백
# ════════════════════════════════════════════════════════════
overall = round(
    gaze_score  * 0.30 +
    speech_score * 0.25 +
    filler_score * 0.25 +
    voice_score  * 0.20
)

grade = ('매우 우수 🌟' if overall >= 90
         else '우수 👍'   if overall >= 80
         else '보통 📈'   if overall >= 60
         else '연습 필요 💪')

print(f"\n{'='*55}")
print(f"  이제 나도 발표왕 👑  종합 점수: {overall}점  ({grade})")
print(f"{'='*55}")
print(f"  시선 처리 점수:   {gaze_score}점  (정면 응시 {fwd}%)")
print(f"  말 속도 점수:     {speech_score}점  (분당 {wpm}어절, 적정 130~170)")
print(f"  말버릇 점수:      {filler_score}점  (총 {filler_count}회)")
print(f"  목소리 안정성:    {voice_score}점")
print(f"{'='*55}")

# 피드백 생성
feedbacks, tips = [], []

if fwd >= 70:
    feedbacks.append(f"👁 시선: 정면 응시 {fwd}%로 매우 훌륭합니다!")
elif fwd >= 50:
    feedbacks.append(f"👁 시선: 정면 응시 {fwd}%. 청중을 조금 더 바라보세요.")
    tips.append("청중을 3~5초 단위로 번갈아 바라보는 연습을 해보세요.")
else:
    feedbacks.append(f"👁 시선: 정면 응시 {fwd}%로 낮습니다. 카메라를 더 자주 바라보세요.")
    tips.append("발표 자료보다 청중을 먼저 바라보는 습관을 기르세요.")

if gaze_pct.get('down', 0) > 30:
    tips.append("발표 자료는 키워드만 적고 자연스럽게 말하는 연습을 해보세요.")

if wpm == 0:
    feedbacks.append("🎙 말 속도: 음성이 인식되지 않았습니다.")
elif 130 <= wpm <= 170:
    feedbacks.append(f"🎙 말 속도: 분당 {wpm}어절로 적절합니다!")
elif wpm < 130:
    feedbacks.append(f"🎙 말 속도: 분당 {wpm}어절로 느립니다.")
    tips.append("적정 속도는 분당 130~170어절입니다. 좀 더 자신 있게 말해보세요.")
else:
    feedbacks.append(f"🎙 말 속도: 분당 {wpm}어절로 빠릅니다.")
    tips.append("중요한 내용에서 의도적으로 속도를 늦추고 짧은 침묵을 활용하세요.")

if filler_count == 0:
    feedbacks.append("💬 말버릇: 불필요한 표현 없음. 완벽합니다!")
elif filler_count <= 5:
    feedbacks.append(f"💬 말버릇: {filler_count}회. 양호한 수준입니다.")
else:
    top = sorted(filler_details.items(), key=lambda x: x[1], reverse=True)[:3]
    feedbacks.append(f"💬 말버릇: {filler_count}회. 특히 {', '.join(f\"'{k}'({v}회)\" for k,v in top)}을 줄이세요.")
    tips.append("말이 막힐 때 '아', '음' 대신 짧은 침묵을 유지하세요.")

if voice_score >= 80:
    feedbacks.append(f"📊 목소리: {voice_score}점으로 매우 안정적입니다!")
elif voice_score >= 60:
    feedbacks.append(f"📊 목소리: {voice_score}점으로 양호합니다.")
    tips.append("발표 전 심호흡 3번으로 목소리를 더욱 안정시켜 보세요.")
elif voice_score >= 40:
    feedbacks.append(f"📊 목소리: {voice_score}점으로 다소 불안정합니다.")
    tips.append("복식호흡으로 말하면 목소리가 훨씬 안정됩니다.")
else:
    feedbacks.append(f"📊 목소리: {voice_score}점으로 많이 불안정합니다.")
    tips.append("매일 5분 복식호흡 발성 연습을 해보세요.")

print("\n📋 분석 피드백:")
for fb in feedbacks:
    print(f"  {fb}")
if tips:
    print("\n💡 개선 팁:")
    for t in tips:
        print(f"  • {t}")

# ════════════════════════════════════════════════════════════
# 10단계: 결과 시각화 (matplotlib)
# ════════════════════════════════════════════════════════════
print("\n📊 결과 차트 생성 중...")

def score_color(s):
    return '#00ff88' if s >= 80 else '#ffa500' if s >= 60 else '#e94560'

fig = plt.figure(figsize=(14, 9))
fig.patch.set_facecolor('#1a1a2e')
gs  = gridspec.GridSpec(2, 3, figure=fig, hspace=0.50, wspace=0.40)

# ─ 종합 점수 도넛 ──────────────────────────────────────────
ax0 = fig.add_subplot(gs[0, 0])
ax0.set_facecolor('#16213e')
sc  = score_color(overall)
ax0.pie([overall, 100 - overall],
        colors=[sc, '#2a2a4a'],
        startangle=90, wedgeprops={'width': 0.4})
ax0.text(0, 0, f'{overall}점', ha='center', va='center',
         fontsize=22, fontweight='bold', color=sc)
ax0.set_title(f'종합 점수\n{grade}', color='white', fontsize=11, pad=10)

# ─ 항목별 점수 막대 ────────────────────────────────────────
ax1 = fig.add_subplot(gs[0, 1:])
ax1.set_facecolor('#16213e')
cats   = ['시선\n처리', '말\n속도', '말\n버릇', '목소리\n안정성']
scores = [gaze_score, speech_score, filler_score, voice_score]
colors = [score_color(s) for s in scores]
bars   = ax1.bar(cats, scores, color=colors, width=0.5, zorder=3)
ax1.set_ylim(0, 115)
ax1.tick_params(colors='white', labelsize=10)
ax1.axhline(y=70, color='#ffa500', linestyle='--', alpha=0.5, linewidth=1.2, label='기준선(70점)')
ax1.grid(axis='y', color='#333355', alpha=0.5, zorder=0)
for sp in ['top', 'right']: ax1.spines[sp].set_visible(False)
for sp in ['bottom', 'left']: ax1.spines[sp].set_color('#444466')
for bar, score in zip(bars, scores):
    ax1.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 2,
             f'{score}점', ha='center', va='bottom', color='white',
             fontsize=10, fontweight='bold')
ax1.legend(facecolor='#16213e', edgecolor='#444466', labelcolor='white', fontsize=9)
ax1.set_title('항목별 점수', color='white', fontsize=12)

# ─ 시선 분포 파이 ──────────────────────────────────────────
ax2 = fig.add_subplot(gs[1, 0])
ax2.set_facecolor('#16213e')
gaze_labels_ko = {'forward': '정면', 'left': '왼쪽', 'right': '오른쪽', 'up': '위', 'down': '아래'}
gaze_palette   = {'forward': '#00ff88', 'left': '#ffa500', 'right': '#ff8020', 'up': '#ffff44', 'down': '#e94560'}
nz = [(gaze_labels_ko[d], gaze_pct[d], gaze_palette[d]) for d in dirs if gaze_pct[d] > 0]
if nz:
    lbls, vals, cols = zip(*nz)
    ax2.pie(vals, labels=lbls, colors=cols, autopct='%1.1f%%', startangle=90,
            textprops={'color': 'white', 'fontsize': 8})
ax2.set_title('👁 시선 분포', color='white', fontsize=11)

# ─ 말 속도 ────────────────────────────────────────────────
ax3 = fig.add_subplot(gs[1, 1])
ax3.set_facecolor('#16213e')
ax3.bar(['실제\nWPM', '목표\nWPM'], [wpm, 150],
        color=[score_color(speech_score), 'rgba(0,255,136,0.5)'])
ax3.bar(['목표\nWPM'], [150], color='#00ff88', alpha=0.5)
ax3.tick_params(colors='white', labelsize=9)
for sp in ['top', 'right']: ax3.spines[sp].set_visible(False)
for sp in ['bottom', 'left']: ax3.spines[sp].set_color('#444466')
ax3.grid(axis='y', color='#333355', alpha=0.5)
ax3.set_title(f'🎙 말 속도\n(분당 {wpm}어절)', color='white', fontsize=10)

# ─ 말버릇 ─────────────────────────────────────────────────
ax4 = fig.add_subplot(gs[1, 2])
ax4.set_facecolor('#16213e')
if filler_details:
    top_f = sorted(filler_details.items(), key=lambda x: x[1], reverse=True)[:6]
    fw_k, fw_v = zip(*top_f)
    ax4.barh(list(fw_k), list(fw_v), color='#e94560')
    ax4.tick_params(colors='white', labelsize=9)
    for sp in ['top', 'right']: ax4.spines[sp].set_visible(False)
    for sp in ['bottom', 'left']: ax4.spines[sp].set_color('#444466')
else:
    ax4.text(0.5, 0.5, '말버릇 없음 ✨',
             ha='center', va='center', color='#00ff88',
             fontsize=13, transform=ax4.transAxes)
ax4.set_title(f'💬 말버릇 (총 {filler_count}회)', color='white', fontsize=10)

plt.suptitle('이제 나도 발표왕 👑  —  발표 분석 결과',
             color='white', fontsize=14, fontweight='bold', y=1.02)
plt.savefig('presentation_result.png', dpi=150,
            bbox_inches='tight', facecolor='#1a1a2e')
plt.show()
print("\n✅ 분석 완료! 결과 이미지가 presentation_result.png 로 저장되었습니다.")

# 결과 이미지 다운로드
colab_files.download('presentation_result.png')
