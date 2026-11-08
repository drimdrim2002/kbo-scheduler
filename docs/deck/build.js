// 매치봇 발표 자료(15분 본편) 만들기 — 계획: docs/DECK_PLAN.md
// 실행: NODE_PATH=<pptxgenjs·sharp·qrcode가 있는 node_modules> node docs/deck/build.js
// 결과: docs/deck/matchbot-talk.pptx
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '../..');
const IMG = (f) => path.join(__dirname, 'img', f); // 발표용 화면 캡처(1280×720 창, 2배 해상도, 번호 표시 없음)
const OUT = path.join(__dirname, 'matchbot-talk.pptx');
const APPLY_THEME = process.env.APPLY_THEME; // pptx 스킬의 scripts/apply_theme.js 경로(있으면 테마 색을 씀)

const FONT = 'Apple SD Gothic Neo';
const THEME = {
  name: 'Matchbot',
  headFontFace: FONT,
  bodyFontFace: FONT,
  colors: {
    dk1: '1F2430', lt1: 'FFFFFF', dk2: '2546A8', lt2: 'F6F7F9',
    accent1: '3B6CF4', accent2: 'B54708', accent3: '7EF0D0', accent4: 'DFE9FF', accent5: '5C6370', accent6: 'D9DDE3',
    hlink: '3B6CF4', folHlink: '2546A8',
  },
};
const HEX = THEME.colors;

// 슬라이드: 13.333 × 7.5 in
const W = 13.333, H = 7.5, MX = 0.6;

async function main() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = '매치봇 스튜디오 — 조건을 넣고 바꿔 가며 KBO 일정을 직접 만들어 보는 솔루션';
  pres.author = '스케쥴랩';
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  const C = pres.SchemeColor;

  // ── 틀(layout) ──
  pres.defineSlideMaster({
    title: 'DARK',
    background: { color: HEX.dk1 },
    objects: [],
  });
  pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: HEX.lt1 },
    margin: [0.5, MX, 0.5, MX],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: MX, y: 0.42, w: W - 2 * MX, h: 1.1, fontFace: FONT, fontSize: 28, bold: true, color: C.text1, valign: 'top', align: 'left', margin: 0 }, text: '' } },
      { text: { text: '매치봇 스튜디오', options: { x: MX, y: H - 0.42, w: 4, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    ],
    slideNumber: { x: W - MX - 0.6, y: H - 0.42, w: 0.6, h: 0.3, fontSize: 10, color: HEX.accent5, align: 'right' },
  });

  // ── 그림 준비 ──
  const meta = {};
  for (const f of fs.readdirSync(path.join(__dirname, 'img'))) {
    if (!f.endsWith('.png')) continue;
    const m = await sharp(IMG(f)).metadata();
    meta[f] = { w: m.width, h: m.height };
  }
  const mascot = await sharp(fs.readFileSync(path.join(__dirname, 'mascot.svg'))).resize(512, 512).png().toBuffer();
  const mascotData = 'image/png;base64,' + mascot.toString('base64');
  const qr = await QRCode.toBuffer('https://schedulelab.kr', { margin: 1, width: 600, color: { dark: '#1F2430', light: '#FFFFFF' } });
  const qrData = 'image/png;base64,' + qr.toString('base64');

  // 상자 안에 비율을 지켜 그림을 넣고, 뒤에 옅은 파란 판을 깐다(이 발표의 반복 모양)
  function shot(slide, file, box, opt = {}) {
    const pad = opt.pad ?? 0.14;
    const m = meta[file];
    const bw = box.w - 2 * pad, bh = box.h - 2 * pad;
    const s = Math.min(bw / m.w, bh / m.h);
    const iw = m.w * s, ih = m.h * s;
    const ix = box.x + pad + (bw - iw) / 2, iy = box.y + pad + (bh - ih) / (opt.top ? 1e9 : 2);
    const fx = ix - pad, fy = iy - pad, fw = iw + 2 * pad, fh = ih + 2 * pad;
    slide.addShape(pres.ShapeType.roundRect, { x: fx, y: fy, w: fw, h: fh, rectRadius: 0.12, fill: { color: C.accent4 }, line: { color: C.accent4 }, objectName: 'frame ' + file });
    slide.addImage({ path: IMG(file), x: ix, y: iy, w: iw, h: ih, altText: opt.alt || file, objectName: file });
    return { x: fx, y: fy, w: fw, h: fh, ix, iy, k: s * 2 }; // k: 화면 1px(CSS)당 인치
  }
  // 그림 위 한 곳을 파란 테두리로 짚는다(r: 캡처 기준 CSS px)
  function ring(slide, b, r) {
    const p = 0.05;
    slide.addShape(pres.ShapeType.roundRect, { x: b.ix + r.x * b.k - p, y: b.iy + r.y * b.k - p, w: r.w * b.k + 2 * p, h: r.h * b.k + 2 * p, rectRadius: 0.06, fill: { type: 'none' }, line: { color: C.accent1, width: 3 }, objectName: 'ring' });
  }
  // 제목 밑 부제(한두 줄, 회색): 제목만으로 모자란 맥락을 쉬운 말로
  function sub(slide, text) {
    slide.addText(text, { x: MX, y: 1.0, w: W - 2 * MX, h: 0.7, fontSize: 16, color: C.accent5, margin: 0, valign: 'top', paraSpaceAfter: 2, isTextBox: true, objectName: 'subtitle' });
  }
  function caption(slide, text, x, y, w, opt = {}) {
    slide.addText(text, { x, y, w, h: opt.h || 0.35, fontSize: 12, color: C.accent5, margin: 0, isTextBox: true, align: opt.align || 'left', valign: 'top' });
  }
  function content(title, notes) {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText(title, { placeholder: 'title' });
    if (notes) s.addNotes(notes);
    return s;
  }
  // 동그라미 번호(두 번째 반복 모양)
  function dot(slide, n, x, y, d = 0.42, fill = C.accent1) {
    slide.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    slide.addText(String(n), { x, y, w: d, h: d, fontSize: 14, bold: true, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
  }
  function card(slide, x, y, w, h, opt = {}) {
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w, h, rectRadius: 0.12,
      fill: { color: opt.fill || C.background2 }, line: { color: opt.line || opt.fill || C.background2, width: opt.lineW || 1 },
      objectName: opt.name,
    });
  }

  // ───────── 1. 표지 ─────────
  {
    const s = pres.addSlide({ masterName: 'DARK' });
    s.addImage({ data: mascotData, x: MX, y: 0.9, w: 1.3, h: 1.3, altText: '매치봇 마스코트' });
    s.addText('매치봇 스튜디오', { x: MX, y: 2.55, w: 11, h: 1.0, fontSize: 48, bold: true, color: C.background1, margin: 0, isTextBox: true });
    s.addText('KBO 리그 일정 자동 편성 솔루션', { x: MX, y: 3.6, w: 11.5, h: 0.7, fontSize: 24, color: C.accent3, margin: 0, isTextBox: true });
    s.addText('스케쥴랩(schedulelab.kr, admin@everyshift.co.kr)', { x: MX, y: H - 1.2, w: W - 2 * MX, h: 0.4, fontSize: 14, color: C.accent6, margin: 0, align: 'right', isTextBox: true });
    s.addNotes('[0:00] 인사. 15초 소개: 공장 생산 계획과 물류 배차 같은 일정 문제를 풀어 온 엔지니어이고, 이 솔루션은 개인 프로젝트로 만들었다.');
  }

  // ───────── 2. A. 아는 장면: 일정 편성은 얽힌 어려운 문제 ─────────
  // 예시(네 구단, 토요일 세 번): 5/8 구장 행사로 홈을 옮기면, 맞출 때마다 어긋남이 다른 구단으로 옮겨 간다
  //   전: SSG 홈·홈·원정(2) · KIA 홈·원정·홈(2) · LG 원정·홈·원정(1) · 롯데 원정·원정·홈(1)
  //   후: SSG 홈·원정·홈(2) · KIA 홈·홈·원정(2) · LG 원정·홈·홈(2) · 롯데 원정·원정·원정(0)
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText([
      { text: '일정 편성은 조건이 서로 얽힌 어려운 문제입니다', options: { breakLine: true } },
      { text: '주말 홈 하나만 바꿔도, 다시 맞출 곳이 줄줄이 생깁니다', options: { fontSize: 20, bold: false, color: C.accent5 } },
    ], { placeholder: 'title' });
    s.addNotes('[0:30] 일정 편성이 왜 어려운지 예시 하나로 보인다. 네 구단, 토요일 세 번만 떼어 봤다. '
      + '① 5/8 문학구장에 행사가 잡혀 SSG–KIA를 KIA 홈으로 옮긴다. SSG는 주말 홈이 하나 줄고 KIA는 하나 는다. '
      + '② 맞추려고 5/15 SSG–롯데를 SSG 홈으로, ③ KIA–LG를 LG 홈으로 바꾼다. SSG·KIA는 맞았지만 이번엔 LG가 하나 늘고, 롯데는 세 주말 내리 원정이 된다. '
      + '어긋남은 사라지지 않고 다른 구단으로 옮겨 갈 뿐이다. 이 그림은 주말 홈 횟수 하나만 따졌다. 실제 시즌은 10개 구단, 45개 기간에서 필수 규칙 15가지와 목표 4가지가 한꺼번에 얽혀 있다.');
    const cell = (a, b, n) => n
      ? { text: [{ text: n + '  ' + a, options: { bold: true, color: HEX.dk2, breakLine: true } }, { text: b, options: { color: HEX.accent5, fontSize: 13 } }], options: { fill: { color: HEX.accent4 } } }
      : { text: [{ text: a, options: { color: HEX.dk1, breakLine: true } }, { text: b, options: { color: HEX.accent5, fontSize: 13 } }] };
    const tally = (a, b) => ({ text: a + ' → ' + b, options: { bold: true, color: a === b ? HEX.accent5 : HEX.accent1, fontSize: 18 } });
    const head = (t, sub) => ({ text: [{ text: t, options: { bold: true, breakLine: !!sub } }, ...(sub ? [{ text: sub, options: { fontSize: 12, color: HEX.accent5 } }] : [])], options: { fill: { color: HEX.lt2 } } });
    const team = (t) => ({ text: t, options: { bold: true } });
    const rows = [
      [head('구단'), head('5/1', '토요일'), head('5/8', '토요일'), head('5/15', '토요일'), head('홈 횟수', '주말')],
      [team('SSG'), cell('홈', 'vs LG'), cell('홈 → 원정', 'vs KIA', '①'), cell('원정 → 홈', 'vs 롯데', '②'), tally('2', '2')],
      [team('KIA'), cell('홈', 'vs 롯데'), cell('원정 → 홈', 'vs SSG', '①'), cell('홈 → 원정', 'vs LG', '③'), tally('2', '2')],
      [team('LG'), cell('원정', 'vs SSG'), cell('홈', 'vs 롯데'), cell('원정 → 홈', 'vs KIA', '③'), tally('1', '2')],
      [team('롯데'), cell('원정', 'vs KIA'), cell('원정', 'vs LG'), cell('홈 → 원정', 'vs SSG', '②'), tally('1', '0')],
    ];
    const ty = 1.85;
    s.addTable(rows, { x: MX, y: ty, w: 7.7, colW: [1.1, 1.6, 1.75, 1.75, 1.5], rowH: [0.55, 0.78, 0.78, 0.78, 0.78], fontFace: FONT, fontSize: 15, color: HEX.dk1, valign: 'middle', align: 'center', border: { type: 'solid', pt: 1, color: HEX.accent6 }, margin: 0.04, objectName: 'example table' });
    // 오른쪽: 고친 순서와 결과
    const rx = 8.75, rw = W - MX - rx;
    ['5/8 문학구장 행사로\nSSG–KIA를 KIA 홈으로', 'SSG 홈이 줄어,\n5/15 SSG–롯데를 SSG 홈으로', 'KIA 홈이 늘어,\n5/15 KIA–LG를 LG 홈으로'].forEach((t, i) => {
      const y = ty - 0.05 + i * 0.78;
      dot(s, i + 1, rx, y + 0.15);
      s.addText(t, { x: rx + 0.6, y, w: rw - 0.6, h: 0.72, fontSize: 15, color: C.text1, valign: 'middle', margin: 0, isTextBox: true });
    });
    const by = ty + 2.35, bh = 5.52 - by;
    card(s, rx, by, rw, bh, { fill: C.accent1, name: 'result' });
    s.addText([
      { text: '이번엔 롯데가 세 주말 내리 원정', options: { fontSize: 15, breakLine: true } },
      { text: '어긋남은 사라지지 않고,\n다른 구단으로 옮겨 갈 뿐입니다', options: { bold: true, fontSize: 17 } },
    ], { x: rx + 0.25, y: by, w: rw - 0.45, h: bh, color: C.background1, valign: 'middle', margin: 0, paraSpaceAfter: 6, isTextBox: true });
    // 아래 띠: 예시와 실제 시즌의 크기
    const sy = 5.8, sh = 1.0, lw = 4.2;
    card(s, MX, sy, W - 2 * MX, sh, { fill: C.background2, line: C.accent6, name: 'scale' });
    s.addText([
      { text: '이 예시', options: { bold: true, color: C.accent5, fontSize: 13, breakLine: true } },
      { text: '4개 구단 · 주말 3번 · 따진 것 1가지', options: { color: C.text1, fontSize: 16 } },
    ], { x: MX + 0.3, y: sy, w: lw, h: sh, valign: 'middle', margin: 0, isTextBox: true });
    s.addShape(pres.ShapeType.rightArrow, { x: MX + 0.3 + lw + 0.05, y: sy + sh / 2 - 0.2, w: 0.5, h: 0.4, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    s.addText([
      { text: '실제 한 시즌 · 모두 한꺼번에 얽힘', options: { bold: true, color: C.accent1, fontSize: 13, breakLine: true } },
      { text: '10개 구단 · 45개 기간 · 필수 규칙 15가지 · 목표 4가지', options: { bold: true, color: C.text1, fontSize: 16 } },
    ], { x: MX + 0.3 + lw + 0.75, y: sy, w: W - 2 * MX - lw - 1.25, h: sh, valign: 'middle', margin: 0, isTextBox: true });
  }

  // ───────── 3. B. 결론 ─────────
  {
    const s = content('매치봇은 요구 사항과 제약을 모두 따져, 몇 분 만에 일정을 만듭니다',
      '[1:30] 결론부터. 편성 담당자가 조건과 운영 방침을 넣으면, 규칙을 모두 지키는 일정을 몇 분 만에 여러 개 만들어 비교하고 고를 수 있다. 화면은 2027 시즌 편성을 검토하는 모습.');
    sub(s, '앞에서 본 얽힌 조건을 사람이 하나씩 따라가는 대신, 매치봇이 시즌 전체를 한꺼번에 맞춥니다.\n조건을 바꿔 가며 여러 번 만들어 보고, 그중 가장 나은 일정을 고르면 됩니다.');
    const b = shot(s, 'review.png', { x: MX, y: 1.85, w: W - 2 * MX, h: 4.85 }, { alt: '매치봇 스튜디오의 편성 조건 확인 화면과 시즌 달력' });
    caption(s, '매치봇 스튜디오 · 2027 시즌 편성 조건을 검토하는 화면', b.x, b.y + b.h + 0.08, 8);
  }

  // ───────── 4. C1. 누가 무엇을 정하나 ─────────
  {
    const s = content('기본 정보·고정 조건·운영 방침은 사람이 정하고,\n나머지 배치는 자동 편성이 합니다',
      '[2:30] 역할 나눔이 핵심. 사람이 정하는 것은 세 가지다. 바뀌지 않는 기본 정보, 꼭 이렇게 해 달라는 고정 조건, 무엇을 먼저 챙길지 정하는 운영 방침. 그 안에서 모든 연전을 날짜에 배치하는 일은 자동 편성이 한다. 결과를 고르고 확정하는 것도 사람이다.');
    const cols = [
      ['기본 정보', '바뀌지 않는 것', ['구단과 구장', '시즌 기간·연전', '구장 사이 거리']],
      ['고정 조건', '꼭 이렇게 해 달라는 것', ['개막 2연전 홈', '어린이날 홈', '특정 연전 고정']],
      ['운영 방침', '무엇을 먼저 챙길지', ['이동 격차 줄이기', '주말·공휴일 격차', '어디까지 줄일지']],
    ];
    const top = 1.95, cw = 2.6, chh = 3.9, gap = 0.25;
    s.addText('운영자가 정합니다', { x: MX, y: top - 0.05, w: 3 * cw + 2 * gap, h: 0.4, fontSize: 15, bold: true, color: C.accent1, margin: 0, isTextBox: true });
    cols.forEach(([t, sub, list], i) => {
      const x = MX + i * (cw + gap), y = top + 0.45;
      card(s, x, y, cw, chh, { fill: C.background2, line: C.accent6 });
      dot(s, i + 1, x + 0.25, y + 0.28);
      s.addText(t, { x: x + 0.8, y: y + 0.22, w: cw - 1, h: 0.55, fontSize: 22, bold: true, color: C.text1, margin: 0, isTextBox: true, valign: 'middle' });
      s.addText(sub, { x: x + 0.25, y: y + 0.85, w: cw - 0.5, h: 0.4, fontSize: 14, color: C.accent5, margin: 0, isTextBox: true });
      s.addText(list.map((v, k) => ({ text: v, options: { bullet: true, breakLine: k < list.length - 1 } })),
        { x: x + 0.25, y: y + 1.4, w: cw - 0.45, h: 2.2, fontSize: 15, color: C.text1, margin: 0, paraSpaceAfter: 8, valign: 'top', isTextBox: true });
    });
    // 화살표 + 자동 편성
    const ax = MX + 3 * cw + 2 * gap + 0.12;
    s.addShape(pres.ShapeType.rightArrow, { x: ax, y: top + 0.45 + chh / 2 - 0.3, w: 0.6, h: 0.6, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    const rx = ax + 0.75, rw = W - MX - rx;
    card(s, rx, top + 0.45, rw, chh, { fill: C.accent1 });
    s.addText('자동 편성이 합니다', { x: rx, y: top - 0.05, w: rw, h: 0.4, fontSize: 15, bold: true, color: C.accent1, margin: 0, isTextBox: true });
    s.addText([
      { text: '모든 연전을\n날짜에 배치', options: { bold: true, fontSize: 20, breakLine: true, paraSpaceAfter: 8 } },
      { text: '필수 규칙은 모두 지키고,\n운영 방침 순서대로\n격차를 줄입니다', options: { fontSize: 14 } },
    ], { x: rx + 0.3, y: top + 0.75, w: rw - 0.6, h: 2.0, color: C.background1, margin: 0, valign: 'top', isTextBox: true });
    s.addText('고르고 확정하는 것은\n다시 사람', { x: rx + 0.3, y: top + 0.45 + chh - 0.9, w: rw - 0.6, h: 0.6, fontSize: 15, bold: true, color: C.accent3, margin: 0, isTextBox: true });
  }

  // ───────── 5. C2. 운영 방침 ─────────
  {
    const s = content('운영 방침은 「무엇을 먼저 줄일지」와 「어디까지 줄일지」로 정합니다',
      '[3:30] 운영 방침 화면. 왼쪽 위에서 우선순위를 고르고, 아래에서 목표마다 허용 수준을 정한다. 예: 이동 횟수 격차 4회, 이동 거리 격차 600km, 주말·공휴일 격차 3점까지는 만족으로 본다. 이 숫자를 바꾸면 다른 일정이 나온다.');
    sub(s, '이동 부담과 주말·공휴일 홈 공평은 둘 다 가장 좋게 만들 수 없어서, 무엇을 먼저 챙길지는 운영자가 정합니다.\n예: 구단 간 이동 거리 차이는 600km까지, 주말·공휴일 홈 차이는 2점까지면 만족으로 봅니다.');
    const b = shot(s, 'policy.png', { x: MX, y: 1.85, w: W - 2 * MX, h: 4.95 }, { alt: '운영 방침 정하기 화면: 우선순위와 허용 수준' });
    caption(s, '운영 방침 · 우선순위(위)와 목표마다 허용 수준(아래)', b.x, b.y + b.h + 0.08, 8);
  }

  // ───────── 6. D1. 조건 입력 ─────────
  {
    const s = content('주요 이벤트 일정을 하나하나 확인하고 고칠 수 있습니다',
      '[4:30] (녹화 영상 자리 1/4) 편성 조건은 네 단계다. 구단 정보, 시즌 기간과 연전 묶음, 주요 이벤트 일정, 확인. 엑셀로 한꺼번에 넣을 수도 있다. 넣은 값이 서로 맞지 않으면 그 자리에서 알려 준다.');
    sub(s, '개막 2연전 홈, 어린이날 홈처럼 미리 정해 둘 날은 매치봇이 먼저 채워 두고, 운영자가 하나씩 보고 수락하거나 고칩니다.\n공휴일과 시즌 달력도 같은 화면에서 함께 확인합니다.');
    const b = shot(s, 'cond3.png', { x: MX, y: 1.85, w: W - 2 * MX, h: 4.85 }, { alt: '편성 조건 입력·검증 화면' });
    caption(s, '편성 조건 입력·검증 · 네 단계 가운데 3단계 주요 이벤트 일정(개막 2연전 홈, 어린이날 홈)', b.x, b.y + b.h + 0.08, 11);
  }

  // ───────── 7. D2. 실행 ─────────
  {
    const s = content('실행하면 규칙을 모두 지킨 일정과 구단별 숫자가 바로 나옵니다',
      '[5:45] (녹화 영상 자리 2/4) 실행 시간은 1~5분 가운데 고른다(기본 2분). 운영 방침을 바꿔 여러 번 실행하면, 실행할 때마다 일정이 하나씩 쌓인다.');
    sub(s, '정한 운영 방침으로 실행을 누르면, 1~5분 안에 일정이 나옵니다(기본 2분).\n목표마다 허용 범위를 지켰는지, 구단별 이동 거리와 주말 홈 횟수가 얼마인지 바로 보입니다.');
    const b = shot(s, 'result.png', { x: MX, y: 1.85, w: W - 2 * MX, h: 4.85 }, { alt: '운영 방침으로 실행한 결과 화면' });
    caption(s, '현재 결과 분석 · 실행이 끝나면 목표별 격차와 구단별 숫자가 바로 보입니다', b.x, b.y + b.h + 0.08, 11);
  }

  // ───────── 8. E1. 점검 ─────────
  {
    const s = content('일정마다 요구 사항을 하나하나 점검할 수 있습니다',
      '[9:30] 믿을 수 있는가. 결과마다 15가지 필수 규칙을 따로 점검해 보여 준다. 자동 편성의 점수와는 별도의 점검이다. 사람이 손으로 고친 일정도 같은 점검을 거친다.');
    sub(s, '「규칙을 모두 지켰다」를 직접 확인하는 화면입니다. 15가지 요구 사항을 시즌 전체와 기간마다 하나씩 셉니다.\n사람이 손으로 고친 일정도 같은 점검을 거치고, 결과는 엑셀로 받아 볼 수 있습니다.');
    const b = shot(s, 'check.png', { x: MX, y: 1.85, w: W - 2 * MX, h: 4.85 }, { alt: '요구 사항 점검표' });
    caption(s, '요구 사항 점검 · 15가지 필수 규칙을 결과마다 따로 확인', b.x, b.y + b.h + 0.08, 9);
  }

  // ───────── 9. D3. 비교 ─────────
  {
    const s = content('여러 일정을 나란히 놓고, 어디서 달라지는지 확인합니다',
      '[7:00] (녹화 영상 자리 3/4) 실행 결과 비교. 두 일정을 고르면, 운영 방침의 순서대로 비교하다가 처음 차이가 나는 곳에 「여기서 갈림」이 붙는다. 어느 쪽을 고를지는 사람이 정한다.');
    sub(s, '운영 방침을 바꿔 실행할 때마다 일정이 하나씩 쌓이고, 그중 두 개를 골라 나란히 봅니다.');
    const b = shot(s, 'compare.png', { x: MX, y: 1.85, w: W - 2 * MX, h: 4.85 }, { alt: '실행 결과 비교 화면: 저장한 버전 목록과 고른 두 버전 비교' });
    ring(s, b, { x: 35, y: 377, w: 480, h: 45 });
    caption(s, '실행 결과 비교 · 두 버전을 고르면, 처음 차이 나는 목표에 「여기서 갈림」이 붙습니다(파란 테두리)', b.x, b.y + b.h + 0.08, 11);
  }

  // ───────── 10. D4. 손대면 다시 맞춘다 ─────────
  {
    const s = content('원하는 경기를 고정하고, 나머지는 자동으로 짤 수 있습니다',
      '[8:15] (녹화 영상 자리 4/4) 결과 고치기. 연전 하나를 원하는 기간에 고정하거나 3연전 홈 구단을 지정하고 「나머지 자동 편성」을 누르면, 고정한 것은 지키고 나머지를 다시 짠다. 기계가 다 짜는 것이 아니라, 사람이 한 군데 손대면 기계가 나머지를 받쳐 준다.');
    sub(s, '꼭 지켜야 할 연전을 고정하면, 고정한 것은 그대로 두고 나머지만 다시 짭니다.');
    const b = shot(s, 'fix.png', { x: MX, y: 1.55, w: W - 2 * MX, h: 5.12 }, { alt: '결과 고치기 화면: 연전 기간 고정 띠, 나머지 자동 편성 단추, 고정한 연전이 표시된 5월 달력' });
    ring(s, b, { x: 318, y: 52, w: 59, h: 37 });
    ring(s, b, { x: 1140, y: 92, w: 129, h: 31 });
    caption(s, '결과 고치기 · 5월 4일·7일 연전을 고정(자물쇠)하고 「나머지 자동 편성」을 누르면, 고정한 것은 지키고 나머지를 다시 짭니다', b.x, b.y + b.h + 0.06, 12);
  }

  // ───────── 11. F. 현실의 제약 ─────────
  {
    const s = content('구장 이전, 우천 취소 같은 현실의 제약도 넣어서 짤 수 있습니다',
      '[10:30] 일정은 해마다 현실의 사정에 부딪힌다. 첫째, 구장 이전. SSG 랜더스는 청라로 옮긴다. 구장 위치를 바꾸면 이동 거리부터 다시 계산해 짠다. '
      + '둘째, 특정 기간 홈 경기 설정. 그 기간 동안 홈 구장을 특정 구단으로 정하거나 풀 수 있다. 예: 개막 2연전은 전년 상위 5개 구단이 홈. '
      + '셋째, 시즌 중 조건 추가. 1차 편성 135경기를 치른 뒤, 우천 취소 경기를 포함해 남은 경기를 편성한다. NC 다이노스처럼 구장 안전 사고로 열지 못한 경기도 남은 일정에 다시 넣는다.');
    const items = [
      ['구장 이전·신축', '구장 위치를 바꾸면, 이동 거리부터\n다시 계산해 짭니다', 'SSG 랜더스: 청라로 이전'],
      ['특정 기간 홈 경기 설정', '그 기간 동안 홈 구장을 특정 구단으로\n정하거나 풀 수 있습니다', '개막 2연전: 전년 상위 5개 구단을\n홈으로 정함'],
      ['시즌 중 조건 추가', '1차 편성 135경기를 치른 뒤, 우천 취소\n경기를 포함해 남은 경기를 편성합니다', 'NC 다이노스: 구장 안전 사고로\n열지 못한 홈 경기를 다시 넣음'],
    ];
    const top = 1.55, gap = 0.3, cw = (W - 2 * MX - 2 * gap) / 3, chh = 4.25;
    items.forEach(([t, how, ex], i) => {
      const x = MX + i * (cw + gap);
      card(s, x, top, cw, chh, { fill: C.background2, line: C.accent6, name: 'constraint ' + (i + 1) });
      dot(s, i + 1, x + 0.3, top + 0.32);
      s.addText(t, { x: x + 0.85, y: top + 0.27, w: cw - 1.05, h: 0.52, fontSize: 20, bold: true, color: C.text1, valign: 'middle', margin: 0, isTextBox: true });
      s.addText(how, { x: x + 0.3, y: top + 1.05, w: cw - 0.55, h: 0.95, fontSize: 15, color: C.text1, valign: 'top', margin: 0, isTextBox: true });
      s.addShape(pres.ShapeType.line, { x: x + 0.3, y: top + 2.2, w: cw - 0.6, h: 0, line: { color: C.accent6, width: 1 } });
      s.addText([{ text: '예', options: { bold: true, color: C.accent1, fontSize: 13, breakLine: true } }, { text: ex, options: { color: C.accent5, fontSize: 14 } }],
        { x: x + 0.3, y: top + 2.38, w: cw - 0.55, h: 1.7, valign: 'top', margin: 0, paraSpaceAfter: 4, isTextBox: true });
    });
    s.addText('조건이 바뀌면 넣고 다시 실행하면 됩니다. 넣어 준 조건 안에서는 규칙을 모두 지킵니다.', { x: MX, y: top + chh + 0.3, w: W - 2 * MX, h: 0.45, fontSize: 16, color: C.text1, margin: 0, isTextBox: true });
  }

  // ───────── 12. H. 초대 ─────────
  {
    const s = pres.addSlide({ masterName: 'DARK' });
    s.addImage({ data: mascotData, x: MX, y: 0.9, w: 1.1, h: 1.1, altText: '매치봇 마스코트' });
    s.addText('schedulelab.kr에서\n경험해 보세요', { x: MX, y: 2.3, w: 8.2, h: 2.1, fontSize: 44, bold: true, color: C.background1, margin: 0, valign: 'top', isTextBox: true });
    s.addText('2027 시즌 편성 조건이 미리 들어 있어, 바로 실행하고 비교해 볼 수 있습니다.\n빠진 규칙이나 현실의 조건이 보이면 알려 주세요.', { x: MX, y: 4.55, w: 8.2, h: 1.0, fontSize: 18, color: C.accent3, margin: 0, valign: 'top', isTextBox: true });
    s.addText('스케쥴랩 · admin@everyshift.co.kr', { x: MX, y: H - 1.2, w: 8, h: 0.4, fontSize: 14, color: C.accent6, margin: 0, isTextBox: true });
    const qs = 3.2, qx = W - MX - qs, qy = 2.0;
    s.addShape(pres.ShapeType.roundRect, { x: qx - 0.2, y: qy - 0.2, w: qs + 0.4, h: qs + 0.4, rectRadius: 0.15, fill: { color: C.background1 }, line: { color: C.background1 } });
    s.addImage({ data: qrData, x: qx, y: qy, w: qs, h: qs, altText: 'schedulelab.kr 주소 QR 코드' });
    s.addText('schedulelab.kr', { x: qx - 0.2, y: qy + qs + 0.3, w: qs + 0.4, h: 0.4, fontSize: 16, color: C.background1, align: 'center', margin: 0, isTextBox: true });
    s.addNotes('[14:00] 초대. 결정이 아니라 확인을 부탁한다: 직접 짜 보기, 빠진 규칙 알려 주기. 질문 받기.');
  }

  await pres.writeFile({ fileName: OUT });
  if (APPLY_THEME) {
    const { applyTheme } = require(APPLY_THEME);
    await applyTheme(OUT, THEME);
  }
  console.log('wrote', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
