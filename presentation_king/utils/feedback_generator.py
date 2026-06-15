from config import IDEAL_WPM_MIN, IDEAL_WPM_MAX


def generate_feedback(results: dict) -> dict:
    feedbacks: list[str] = []
    tips: list[str] = []

    # ── 시선 처리 ──────────────────────────────────────────
    gaze = results.get("gaze", {})
    if gaze:
        fwd = gaze.get("forward_percent", 0)
        down = gaze.get("percentages", {}).get("down", 0)

        if fwd >= 70:
            feedbacks.append(
                f"👁 시선 처리: 정면 응시 비율이 {fwd}%로 매우 훌륭합니다! "
                "청중과의 눈맞춤이 잘 이루어졌습니다."
            )
        elif fwd >= 50:
            feedbacks.append(
                f"👁 시선 처리: 정면 응시 비율이 {fwd}%입니다. "
                "청중을 조금 더 바라보는 연습을 해보세요."
            )
            tips.append("청중을 3~5초 단위로 번갈아 바라보는 연습을 해보세요.")
        else:
            feedbacks.append(
                f"👁 시선 처리: 정면 응시 비율이 {fwd}%로 낮습니다. "
                "카메라(청중)를 훨씬 더 자주 바라봐야 합니다."
            )
            tips.append("발표 자료보다 청중을 먼저 바라보는 습관을 기르세요.")

        if down > 30:
            feedbacks.append(
                f"👁 아래를 보는 비율이 {down}%로 높습니다. "
                "메모나 자료에 너무 의존하고 있을 수 있습니다."
            )
            tips.append(
                "발표 자료는 키워드만 적고, 내용은 자연스럽게 말하는 연습을 해보세요."
            )

    # ── 말 속도 ───────────────────────────────────────────
    speech = results.get("speech", {})
    if speech and not speech.get("error"):
        wpm = speech.get("wpm", 0)

        if IDEAL_WPM_MIN <= wpm <= IDEAL_WPM_MAX:
            feedbacks.append(
                f"🎙 말 속도: 분당 {wpm}어절로 적절합니다. "
                "청중이 내용을 충분히 따라올 수 있는 속도입니다."
            )
        elif wpm < IDEAL_WPM_MIN:
            feedbacks.append(
                f"🎙 말 속도: 분당 {wpm}어절로 다소 느립니다. "
                "조금 더 자신감 있게 말해보세요."
            )
            tips.append(
                f"적정 속도는 분당 {IDEAL_WPM_MIN}~{IDEAL_WPM_MAX}어절입니다. "
                "평소보다 살짝 빠르게 말하는 연습을 해보세요."
            )
        else:
            feedbacks.append(
                f"🎙 말 속도: 분당 {wpm}어절로 다소 빠릅니다. "
                "청중이 내용을 따라오기 힘들 수 있습니다."
            )
            tips.append(
                "중요한 내용을 말할 때는 의도적으로 속도를 늦추고, "
                "짧은 침묵(포즈)을 활용해 보세요."
            )

        # ── 말버릇 ─────────────────────────────────────────
        filler_count = speech.get("filler_count", 0)
        filler_details = speech.get("filler_details", {})

        if filler_count == 0:
            feedbacks.append(
                "💬 말버릇: 불필요한 말버릇이 전혀 감지되지 않았습니다. 완벽합니다!"
            )
        elif filler_count <= 5:
            feedbacks.append(
                f"💬 말버릇: 불필요한 표현이 {filler_count}회 감지되었습니다. "
                "양호한 수준입니다."
            )
        else:
            top = sorted(filler_details.items(), key=lambda x: x[1], reverse=True)[:3]
            top_str = ", ".join(f"'{k}'({v}회)" for k, v in top)
            feedbacks.append(
                f"💬 말버릇: 불필요한 표현이 {filler_count}회 감지되었습니다. "
                f"특히 {top_str}을 줄여보세요."
            )
            tips.append(
                "말이 막힐 때 '아', '음' 대신 짧은 침묵을 유지해 보세요. "
                "침묵도 발표의 강력한 도구입니다."
            )

    elif speech and speech.get("error"):
        feedbacks.append(f"💬 음성 분석 오류: {speech['error']}")

    # ── 목소리 안정성 ─────────────────────────────────────
    voice = results.get("voice", {})
    if voice and not voice.get("error"):
        vs = voice.get("stability_score", 50)

        if vs >= 80:
            feedbacks.append(
                f"📊 목소리 안정성: {vs}점으로 매우 안정적입니다. "
                "자신감 넘치는 목소리입니다!"
            )
        elif vs >= 60:
            feedbacks.append(
                f"📊 목소리 안정성: {vs}점으로 양호합니다."
            )
            tips.append(
                "발표 전 심호흡을 3번 하면 목소리 안정에 큰 도움이 됩니다."
            )
        elif vs >= 40:
            feedbacks.append(
                f"📊 목소리 안정성: {vs}점으로 다소 불안정합니다. "
                "긴장을 풀고 복식호흡으로 말해보세요."
            )
            tips.append(
                "발표 전 물을 마시고 목을 충분히 풀어주세요. "
                "복식호흡으로 말하면 목소리가 훨씬 안정됩니다."
            )
        else:
            feedbacks.append(
                f"📊 목소리 안정성: {vs}점으로 많이 불안정합니다. "
                "꾸준한 발성 연습이 필요합니다."
            )
            tips.append(
                "매일 5분 복식호흡 발성 연습을 해보세요. "
                "배에서 나오는 목소리는 훨씬 더 안정적으로 들립니다."
            )

    return {"feedbacks": feedbacks, "tips": tips}
