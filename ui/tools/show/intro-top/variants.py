#!/usr/bin/env python3
"""소개 쪽 맨 위 「매치봇이 무엇인지」 한두 줄 — 표준과 옵션(2026-11-08).
  python3 variants.py <안> <index.html> <show.css>   해당 안을 끼운다
안: std(표준) / copy(옵션 1 · 문구: 운영자 대신 '직접') / chip(옵션 2 · 스튜디오 열기 단추 추가)
"""
import sys

TEXT = {
    'std': ('매치봇은 KBO 일정 편성 스튜디오예요',
            '운영자가 값을 직접 넣고, 조건을 검토하고, 운영 방침에 따라 여러 번 편성해 볼 수 있어요. 이 쪽에서는 2025 일정으로 해 본 결과를 보여 드려요.'),
    'copy': ('일정을 직접 짜 보는 스튜디오, 매치봇',
             '값을 넣고, 조건을 따져 보고, 운영 방침을 바꿔 가며 일정을 여러 번 만들어 견줘 봐요. 이 쪽에서는 2025 일정으로 해 본 결과를 보여 드려요.'),
}
TEXT['chip'] = TEXT['std']

CSS = """
/* 소개 맨 위 정의 한두 줄(2026-11-08 사용자: 소개가 배경보다 먼저 와야 자연스럽다는 의견 → 이야기 순서는 두고 맨 위에 정의만) */
.sh-intro { margin: 0 0 28px; padding: 0 0 20px; border-bottom: 1px solid var(--line); }
.sh-intro-t { font-size: var(--sh-fs-h2); font-weight: 800; line-height: 1.3; letter-spacing: -.01em; margin: 0 0 6px; color: var(--fg); }
.sh-intro-d { font-size: var(--sh-fs-desc); line-height: 1.6; color: var(--muted); margin: 0; word-break: keep-all; }
.sh-intro .sh-chip { margin-top: 12px; }
"""

ANCHOR = '    <div class="sh-chap sh-chap-why">\n'


def block(v):
    t, d = TEXT[v]
    chip = ('\n      <a class="sh-chip" href="../index.html" data-studio data-pc-note>매치봇 스튜디오 열기(PC)</a>' if v == 'chip' else '')
    return ('    <!-- 맨 위 정의(2026-11-08): 매치봇 = KBO 운영자용 편성 스튜디오. 2025 다시 짜기는 그 예시 -->\n'
            '    <div class="sh-intro">\n      <h1 class="sh-intro-t" id="page-h">%s</h1>\n      <p class="sh-intro-d">%s</p>%s\n    </div>\n') % (t, d, chip)


if __name__ == '__main__':
    v, html, css = sys.argv[1:4]
    s = open(html, encoding='utf-8').read()
    assert s.count(ANCHOR) == 1 and 'class="sh-intro"' not in s
    open(html, 'w', encoding='utf-8').write(s.replace(ANCHOR, ANCHOR + block(v)))
    c = open(css, encoding='utf-8').read()
    if '.sh-intro {' not in c:
        open(css, 'w', encoding='utf-8').write(c.rstrip('\n') + '\n' + CSS)
    print(v, 'ok')
