// 매치봇 발표 자료(15분 본편) 만들기 — 계획: docs/DECK_PLAN.md
// 실행: NODE_PATH=<pptxgenjs·sharp·qrcode가 있는 node_modules> node docs/deck/build.js
// 결과: docs/deck/matchbot-talk.pptx
const path = require('path');
const fs = require('fs');
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const QRCode = require('qrcode');

const ROOT = path.resolve(__dirname, '../..');
const IMG = (f) => path.join(ROOT, 'docs/manual/img', f);
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
  pres.title = '매치봇 스튜디오 — 조건을 넣고 바꿔 가며 KBO 일정을 직접 만들어 보는 도구';
  pres.author = '시프트랩';
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
      { placeholder: { options: { name: 'title', type: 'title', x: MX, y: 0.42, w: W - 2 * MX, h: 1.1, fontFace: FONT, fontSize: 28, bold: true, color: C.text1, valign: 'top', margin: 0 }, text: '' } },
      { text: { text: '매치봇 스튜디오', options: { x: MX, y: H - 0.42, w: 4, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
    ],
    slideNumber: { x: W - MX - 0.6, y: H - 0.42, w: 0.6, h: 0.3, fontSize: 10, color: HEX.accent5, align: 'right' },
  });

  // ── 그림 준비 ──
  const meta = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'docs/manual/img'))) {
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
    return { x: fx, y: fy, w: fw, h: fh };
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
    s.addText('조건을 넣고 바꿔 가며, KBO 일정을 직접 만들어 보는 도구', { x: MX, y: 3.6, w: 11.5, h: 0.7, fontSize: 24, color: C.accent3, margin: 0, isTextBox: true });
    s.addText('시프트랩 · admin@everyshift.co.kr · schedulelab.kr', { x: MX, y: H - 1.2, w: 11, h: 0.4, fontSize: 14, color: C.accent6, margin: 0, isTextBox: true });
    s.addNotes('[0:00] 인사. 15초 소개: 공장 생산 계획과 물류 배차 같은 일정 문제를 풀어 온 엔지니어이고, 이 도구는 개인 프로젝트로 만들었다.');
  }

  // ───────── 2. A. 아는 장면 ─────────
  {
    const s = content('일정의 조건은 서로 얽혀 있어서,\n하나를 바꾸면 시즌 전체가 달라집니다',
      '[0:30] 예를 하나 든다. 어린이날 홈 구단 하나를 바꾸면, 그 주의 이동, 앞뒤 연전의 홈·원정, 주말·공휴일 홈 횟수, 다른 구단의 대진까지 줄줄이 바뀐다. 사람이 이 연쇄를 머릿속으로 다 따라가기는 어렵다.');
    const cx = W / 2, cy = 4.45;
    const cw = 3.6, ch = 1.15;
    // 가운데
    card(s, cx - cw / 2, cy - ch / 2, cw, ch, { fill: C.accent1, name: 'center' });
    s.addText([{ text: '어린이날 홈 구단', options: { bold: true, fontSize: 20, breakLine: true } }, { text: '하나를 바꾸면', options: { fontSize: 16 } }],
      { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, color: C.background1, align: 'center', valign: 'middle', margin: 0, isTextBox: true });
    const items = [
      ['그 주의 이동 거리', '두 구단의 이동이 달라집니다', MX + 0.2, 2.05],
      ['앞뒤 연전의 홈·원정', '연속 원정이 생기거나 사라집니다', W - MX - 3.9, 2.05],
      ['주말·공휴일 홈 횟수', '구단 사이 공평이 흔들립니다', MX + 0.2, 5.55],
      ['다른 구단의 대진', '빈자리를 채우려 일정이 밀립니다', W - MX - 3.9, 5.55],
    ];
    for (const [t, d, x, y] of items) {
      const bw = 3.7, bh = 1.1;
      card(s, x, y, bw, bh, { fill: C.background2, line: C.accent6 });
      s.addText([{ text: t, options: { bold: true, fontSize: 17, color: C.text1, breakLine: true } }, { text: d, options: { fontSize: 14, color: C.accent5 } }],
        { x: x + 0.25, y, w: bw - 0.4, h: bh, valign: 'middle', margin: 0, isTextBox: true });
      const ex = x < cx ? x + bw : x, ey = y + bh / 2;
      const sx = x < cx ? cx - cw / 2 : cx + cw / 2, sy = ey < cy ? cy - ch / 2 + 0.2 : cy + ch / 2 - 0.2;
      s.addShape(pres.ShapeType.line, { x: Math.min(sx, ex), y: Math.min(sy, ey), w: Math.abs(ex - sx), h: Math.abs(ey - sy), flipV: (ex < sx) !== (ey < sy), line: { color: C.accent1, width: 1.5, dashType: 'dash' } });
    }
  }

  // ───────── 3. B. 결론 ─────────
  {
    const s = content('조건을 넣고 바꿔 가며\n일정을 직접 만들어 보는 도구를 만들었습니다',
      '[1:30] 결론부터. 편성 담당자가 조건과 방침을 넣으면, 규칙을 모두 지키는 일정을 몇 분 만에 여러 개 만들어 비교하고 고를 수 있다. 화면은 2027 시즌 편성을 검토하는 모습.');
    const b = shot(s, 'fig-3-5.png', { x: MX, y: 1.7, w: W - 2 * MX, h: 5.15 }, { alt: '매치봇 스튜디오의 편성 조건 확인 화면과 시즌 달력' });
    caption(s, '매치봇 스튜디오 · 2027 시즌 편성 조건을 검토하는 화면', b.x, b.y + b.h + 0.08, 8);
  }

  // ───────── 4. C1. 누가 무엇을 정하나 ─────────
  {
    const s = content('사실과 지정과 방침은 사람이 정하고,\n나머지 배치는 자동 편성이 합니다',
      '[2:30] 역할 나눔이 핵심. 사람이 정하는 것은 세 가지다. 바뀌지 않는 사실, 꼭 이렇게 해 달라는 지정, 무엇을 먼저 챙길지 정하는 방침. 그 안에서 모든 연전을 날짜에 배치하는 일은 자동 편성이 한다. 결과를 고르고 확정하는 것도 사람이다.');
    const cols = [
      ['사실', '바뀌지 않는 것', ['구단과 구장', '시즌 기간과 연전 묶음', '구장 사이 거리']],
      ['지정', '꼭 이렇게 해 달라는 것', ['개막 2연전 홈', '어린이날 홈', '특정 연전 고정']],
      ['방침', '무엇을 먼저 챙길지', ['이동 격차 줄이기', '주말·공휴일 격차 줄이기', '어디까지 참을지(허용 수준)']],
    ];
    const top = 1.95, cw = 2.75, chh = 3.9, gap = 0.3;
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
    const ax = MX + 3 * cw + 2 * gap + 0.15;
    s.addShape(pres.ShapeType.rightArrow, { x: ax, y: top + 0.45 + chh / 2 - 0.35, w: 0.7, h: 0.7, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    const rx = ax + 0.9, rw = W - MX - rx;
    card(s, rx, top + 0.45, rw, chh, { fill: C.accent1 });
    s.addText('자동 편성이 합니다', { x: rx, y: top - 0.05, w: rw, h: 0.4, fontSize: 15, bold: true, color: C.accent1, margin: 0, isTextBox: true });
    s.addText([
      { text: '모든 연전을 날짜에 배치', options: { bold: true, fontSize: 20, breakLine: true } },
      { text: '필수 규칙은 모두 지키고, 방침의 순서대로 격차를 줄입니다', options: { fontSize: 15 } },
    ], { x: rx + 0.3, y: top + 0.75, w: rw - 0.6, h: 2.0, color: C.background1, margin: 0, valign: 'top', isTextBox: true });
    s.addText('고르고 확정하는 것은 다시 사람', { x: rx + 0.3, y: top + 0.45 + chh - 0.9, w: rw - 0.6, h: 0.6, fontSize: 15, bold: true, color: C.accent3, margin: 0, isTextBox: true });
  }

  // ───────── 5. C2. 방침 ─────────
  {
    const s = content('방침은 「무엇을 먼저 줄일지」와\n「어디까지 참을지」로 정합니다',
      '[3:30] 방침 화면. 왼쪽 위에서 우선순위를 고르고, 아래에서 목표마다 허용 수준을 정한다. 예: 이동 횟수 격차 4회, 이동 거리 격차 600km, 주말·공휴일 격차 3점까지는 만족으로 본다. 이 숫자를 바꾸면 다른 일정이 나온다.');
    const b = shot(s, 'fig-3-8.png', { x: MX, y: 1.75, w: W - 2 * MX, h: 4.9 }, { alt: '운영 방침 정하기 화면: 우선순위와 허용 수준' });
    caption(s, '운영 방침 · 우선순위(위)와 목표마다 허용 수준(아래)', b.x, b.y + b.h + 0.08, 8);
  }

  // ───────── 6. D1. 조건 입력 ─────────
  {
    const s = content('조건을 넣으면, 화면이 하나하나 검증합니다',
      '[4:30] (녹화 영상 자리 1/4) 편성 조건은 네 단계다. 구단 정보, 시즌 기간과 연전 묶음, 주요 이벤트 일정, 확인. 엑셀로 한꺼번에 넣을 수도 있다. 넣은 값이 서로 맞지 않으면 그 자리에서 알려 준다.');
    const b = shot(s, 'fig-4-1.png', { x: MX, y: 1.3, w: W - 2 * MX, h: 5.55 }, { alt: '편성 조건 입력·검증 화면' });
    caption(s, '편성 조건 입력·검증 · 구단 정보 → 시즌 기간·연전 묶음 → 주요 이벤트 일정 → 확인', b.x, b.y + b.h + 0.08, 11);
  }

  // ───────── 7. D2. 실행 ─────────
  {
    const s = content('방침마다, 규칙을 모두 지키는 일정이\n몇 분 안에 나옵니다',
      '[5:45] (녹화 영상 자리 2/4) 실행 시간은 1~5분 가운데 고른다(기본 2분). 방침을 바꿔 여러 번 실행하면, 실행할 때마다 일정이 하나씩 쌓인다.');
    const b = shot(s, 'fig-5-4.png', { x: MX, y: 1.75, w: W - 2 * MX, h: 5.1 }, { alt: '운영 방침으로 실행한 결과 화면' });
    caption(s, '운영 방침·실행 · 실행이 끝나면 목표별 격차와 구단별 숫자가 바로 보입니다', b.x, b.y + b.h + 0.08, 11);
  }

  // ───────── 8. D3. 비교 ─────────
  {
    const s = content('여러 일정을 나란히 놓고,\n처음 갈리는 곳부터 비교합니다',
      '[7:00] (녹화 영상 자리 3/4) 실행 결과 비교. 두 일정을 고르면, 방침의 순서대로 비교하다가 처음 차이가 나는 곳에 「여기서 갈림」이 붙는다. 어느 쪽을 고를지는 사람이 정한다.');
    const L = shot(s, 'fig-7-1.png', { x: MX, y: 1.75, w: 7.9, h: 5.0 }, { alt: '실행 결과 비교 화면' });
    const rx = L.x + L.w + 0.35;
    const R = shot(s, 'fig-3-9.png', { x: rx, y: 1.75, w: W - MX - rx, h: 4.3 }, { alt: '여기서 갈림 표시' });
    caption(s, '실행 결과 비교', L.x, L.y + L.h + 0.08, 4);
    caption(s, '「여기서 갈림」 · 처음 차이 나는 목표', R.x, R.y + R.h + 0.08, R.w);
  }

  // ───────── 9. D4. 손대면 다시 맞춘다 ─────────
  {
    const s = content('사람이 손대면, 나머지는 자동 편성이 다시 맞춥니다',
      '[8:15] (녹화 영상 자리 4/4) 결과 고치기. 연전 하나를 원하는 기간에 고정하거나 3연전 홈 구단을 지정하고 「나머지 자동 편성」을 누르면, 고정한 것은 지키고 나머지를 다시 짠다. 기계가 다 짜는 것이 아니라, 사람이 한 군데 손대면 기계가 나머지를 받쳐 준다.');
    const T = shot(s, 'fig-6-6.png', { x: MX, y: 1.35, w: W - 2 * MX, h: 1.9 }, { alt: '연전 기간 고정 띠와 나머지 자동 편성 단추' });
    const B = shot(s, 'fig-6-5.png', { x: MX, y: T.y + T.h + 0.25, w: W - 2 * MX, h: H - 0.75 - (T.y + T.h + 0.25) }, { alt: '고정한 연전이 표시된 달력' });
    caption(s, '위: 연전 기간 고정 → 「나머지 자동 편성」   아래: 고정한 연전(핀 표시)은 그 자리에 남습니다', B.x, B.y + B.h + 0.06, 11);
  }

  // ───────── 10. E1. 점검 ─────────
  {
    const s = content('어떤 일정이든,\n필수 규칙을 하나하나 점검합니다',
      '[9:30] 믿을 수 있는가. 결과마다 15가지 필수 규칙을 따로 점검해 보여 준다. 자동 편성의 점수와는 별도의 점검이다. 사람이 손으로 고친 일정도 같은 점검을 거친다.');
    const b = shot(s, 'fig-6-2.png', { x: MX, y: 1.75, w: W - 2 * MX, h: 5.05 }, { alt: '요구 사항 점검표' });
    caption(s, '요구 사항 점검 · 15가지 필수 규칙을 결과마다 따로 확인', b.x, b.y + b.h + 0.08, 9);
  }

  // ───────── 11. E2. 참고 숫자 ─────────
  {
    const s = content('같은 잣대로 재 보면, 이 정도 일정이 나옵니다',
      '[10:30] 예시 하나. 2025년 KBO가 발표한 1차 일정 구간을 같은 잣대로 재 본 숫자다. 매치봇이 받은 입력(대진, 규칙, 거리)은 KBO가 실제로 쓰는 것과 다르므로 우열 비교가 아니라 참고다. 강조하지 말 것.');
    const rows = [
      ['필수 규칙 위반', '—', '0건'],
      ['구단 간 이동 격차', '1,603km', '716km'],
      ['10개 구단 총 이동거리', '71,213km', '61,803km'],
    ];
    const tx = MX, tw = 7.6, ty = 1.85;
    s.addTable([
      [
        { text: '', options: { fill: { color: HEX.lt1 } } },
        { text: '2025 실제 일정 (KBO 발표 1차)', options: { bold: true, color: HEX.accent2, fill: { color: HEX.lt1 } } },
        { text: '매치봇 예시 결과', options: { bold: true, color: HEX.accent1, fill: { color: HEX.lt1 } } },
      ],
      ...rows.map(([a, b, c]) => [
        { text: a, options: { bold: true, color: HEX.dk1 } },
        { text: b, options: { color: HEX.accent2, align: 'right' } },
        { text: c, options: { color: HEX.accent1, bold: true, align: 'right' } },
      ]),
    ], { x: tx, y: ty, w: tw, colW: [2.8, 2.6, 2.2], fontFace: FONT, fontSize: 16, rowH: 0.62, valign: 'middle', border: { type: 'solid', color: HEX.accent6, pt: 1 }, fill: { color: HEX.lt2 } });
    const nx = tx + tw + 0.4, nw = W - MX - nx;
    card(s, nx, ty, nw, 2.48, { fill: C.background2, line: C.accent6 });
    s.addText([
      { text: '이 숫자를 읽는 법', options: { bold: true, fontSize: 16, color: C.text1, breakLine: true } },
      { text: '입력(대진·규칙·거리)이 KBO가 실제로 쓰는 것과 다릅니다. 우열 비교가 아니라 도구가 낼 수 있는 일정의 참고입니다.', options: { fontSize: 14, color: C.accent5 } },
    ], { x: nx + 0.25, y: ty + 0.15, w: nw - 0.5, h: 2.2, valign: 'top', margin: 0, isTextBox: true, paraSpaceAfter: 6 });
    caption(s, '범위: 2025-03-22 ~ 08-29, 225시리즈, 45개 연전 묶음 · 같은 계산 방법으로 두 일정을 잼', tx, ty + 0.62 * 4 + 0.2, 11);
  }

  // ───────── 12. F. 아직 모르는 것 ─────────
  {
    const s = content('도구가 모르는 조건은, 사람이 알려 줘야 합니다',
      '[11:30] 틀릴 수 있는 이유. 도구는 넣어 준 조건만 안다. 그해 구장 사정, 중계 편성, 구단별 요청처럼 화면에 넣지 않은 것은 모른다. 특정 날짜에 홈을 못 여는 조건은 지원 예정이다. 그래서 KBO가 실제로 쓰는 조건을 한 번 넣어 보고 싶다.');
    const items = [
      ['그해 구장 사정', '공사, 대관, 임시 구장처럼 해마다 달라지는 것'],
      ['중계 편성', '방송사가 원하는 경기와 시간대'],
      ['구단별 요청', '구단마다 따로 들어오는 부탁'],
      ['특정 날짜 홈 불가', '지원 예정'],
    ];
    const top = 1.95, cw = (W - 2 * MX - 3 * 0.3) / 4, chh = 3.4;
    items.forEach(([t, d], i) => {
      const x = MX + i * (cw + 0.3);
      const soon = d === '지원 예정';
      card(s, x, top, cw, chh, { fill: soon ? C.background1 : C.background2, line: soon ? C.accent1 : C.accent6, lineW: soon ? 1.5 : 1 });
      dot(s, i + 1, x + 0.25, top + 0.3, 0.42, soon ? C.accent1 : C.accent5);
      s.addText(t, { x: x + 0.25, y: top + 0.95, w: cw - 0.5, h: 0.9, fontSize: 18, bold: true, color: C.text1, margin: 0, valign: 'top', isTextBox: true });
      s.addText(d, { x: x + 0.25, y: top + 1.9, w: cw - 0.5, h: 1.3, fontSize: 14, color: soon ? C.accent1 : C.accent5, bold: soon, margin: 0, valign: 'top', isTextBox: true });
    });
    s.addText('넣어 준 조건 안에서는 규칙을 모두 지킵니다. 넣지 않은 조건은 모릅니다.', { x: MX, y: top + chh + 0.35, w: W - 2 * MX, h: 0.5, fontSize: 16, color: C.text1, margin: 0, isTextBox: true });
  }

  // ───────── 13. G. 방법 한 장 ─────────
  {
    const s = content('먼저 규칙을 모두 지키는 일정을 만들고,\n여러 번 다듬어 가장 나은 것을 고릅니다',
      '[12:30] 방법은 한 장으로. 1단계: 필수 규칙을 모두 지키는 첫 일정을 만든다(1초 안팎). 2단계: 출발점을 여러 개 두고 동시에 다듬는다. 연전을 바꿔 보고 나아지면 받아들이기를 반복한다. 3단계: 그중 방침에 가장 맞는 일정을 고른다. 출발점에 따라 결과가 꽤 달라서 여러 번 돌리는 것이 중요했다.');
    const steps = [
      ['규칙을 모두 지키는\n첫 일정 만들기', '필수 규칙 위반 0건에서 출발'],
      ['여러 출발점에서\n동시에 다듬기', '연전을 바꿔 보고, 나아지면 받아들이기를 반복'],
      ['방침에 가장 맞는\n일정 고르기', '방침의 순서대로 비교해 가장 나은 것'],
    ];
    const top = 2.25, bw = 3.55, bh = 3.3, gap = 0.62;
    steps.forEach(([t, d], i) => {
      const x = MX + i * (bw + gap);
      card(s, x, top, bw, bh, { fill: i === 2 ? C.accent1 : C.background2, line: i === 2 ? C.accent1 : C.accent6 });
      dot(s, i + 1, x + 0.3, top + 0.3, 0.5, i === 2 ? C.text1 : C.accent1);
      s.addText(t, { x: x + 0.3, y: top + 1.0, w: bw - 0.6, h: 1.1, fontSize: 19, bold: true, color: i === 2 ? C.background1 : C.text1, margin: 0, valign: 'top', isTextBox: true });
      s.addText(d, { x: x + 0.3, y: top + 2.2, w: bw - 0.6, h: 0.9, fontSize: 14, color: i === 2 ? C.background1 : C.accent5, margin: 0, valign: 'top', isTextBox: true });
      if (i < 2) s.addShape(pres.ShapeType.rightArrow, { x: x + bw + 0.1, y: top + bh / 2 - 0.22, w: 0.42, h: 0.44, fill: { color: C.accent1 }, line: { color: C.accent1 } });
    });
  }

  // ───────── 14. H. 초대 ─────────
  {
    const s = pres.addSlide({ masterName: 'DARK' });
    s.addImage({ data: mascotData, x: MX, y: 0.9, w: 1.1, h: 1.1, altText: '매치봇 마스코트' });
    s.addText('schedulelab.kr에서\n직접 짜 보세요', { x: MX, y: 2.3, w: 8.2, h: 2.1, fontSize: 44, bold: true, color: C.background1, margin: 0, valign: 'top', isTextBox: true });
    s.addText('조건을 넣고, 방침을 바꾸고, 결과를 비교해 보세요.\n빠진 규칙이 보이면 알려 주세요.', { x: MX, y: 4.55, w: 8.2, h: 1.0, fontSize: 18, color: C.accent3, margin: 0, valign: 'top', isTextBox: true });
    s.addText('시프트랩 · admin@everyshift.co.kr', { x: MX, y: H - 1.2, w: 8, h: 0.4, fontSize: 14, color: C.accent6, margin: 0, isTextBox: true });
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
