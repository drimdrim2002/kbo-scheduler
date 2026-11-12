/*
 * 편성 기록 화면(관리자)의 공통 부분: 서버에서 기록 읽기, 기록 한 줄을 화면 말로 바꾸기, 입력 내려받기.
 * 비밀번호는 이 파일 안의 변수에만 둔다(브라우저 저장소에 남기지 않는다).
 * file://로 열면 서버가 없으므로 sample-history.js의 예시 기록을 보여 준다.
 * 서버 API: POST /api/v1/history { password, date? } → { dates[], date, entries[] }
 *           POST /api/v1/history/entry { password, date, index } → 기록 한 건 전체(보낸 입력 포함)
 */
(function () {
  'use strict';
  const offline = location.protocol === 'file:';
  let password = '';

  const post = (path, body) => fetch('/api/v1/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ password }, body))
  }).then((r) => r.json().catch(() => ({})).then((j) => {
    if (!r.ok) {
      const e = new Error(j.error || '서버가 답하지 않습니다. 잠시 뒤 다시 해 주세요.');
      e.status = r.status;
      throw e;
    }
    return j;
  }), () => { throw new Error('서버에 연결하지 못했습니다.'); });

  const sample = () => window.KBO_ADMIN_SAMPLE || { dates: [], byDate: {} };

  /** 비밀번호 확인 겸 첫 목록. 맞으면 비밀번호를 기억한다(이 페이지가 열려 있는 동안만). */
  function signIn(pw) {
    if (!pw) return Promise.reject(new Error('관리자 비밀번호를 적어 주세요.'));
    if (offline) { password = pw; return load(null); }
    const before = password;
    password = pw;
    return load(null).catch((e) => { password = before; throw e; });
  }

  /** 그 날의 기록. date가 없으면 가장 최근 날. */
  function load(date) {
    if (offline) {
      const s = sample(), d = date || s.dates[0] || '';
      return Promise.resolve({ dates: s.dates, date: d, entries: (s.byDate[d] || []).slice(), sample: true });
    }
    return post('history', date ? { date } : {});
  }

  /** 기록 한 건 전체(보낸 입력 포함). */
  function entry(date, index) {
    if (offline) {
      const row = (sample().byDate[date] || []).find((e) => e.index === index);
      return Promise.resolve(Object.assign({}, row, { problem: { note: '예시 기록이라 실제 입력이 없습니다.' } }));
    }
    return post('history/entry', { date, index });
  }

  /** 입력 내려받기: 그 기록 한 건 전체를 파일로 저장한다. */
  function download(date, index) {
    return entry(date, index).then((full) => {
      const blob = new Blob([JSON.stringify(full, null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '편성기록-' + date + '-' + String(index + 1).padStart(3, '0') + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
  }

  // ───── 화면 말 ─────

  const KST = 9 * 3600 * 1000;
  const kst = (iso) => { const t = Date.parse(iso); return Number.isNaN(t) ? null : new Date(t + KST); };
  const two = (n) => String(n).padStart(2, '0');

  /** "14:05:31" (한국 시각) */
  function timeOf(iso) {
    const d = kst(iso);
    return d ? two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ':' + two(d.getUTCSeconds()) : '';
  }

  /** "11월 12일 (목)" */
  function dayLabel(date) {
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
    if (!p) return date || '';
    const w = '일월화수목금토'[new Date(Date.UTC(+p[1], +p[2] - 1, +p[3])).getUTCDay()];
    return (+p[2]) + '월 ' + (+p[3]) + '일 (' + w + ')';
  }

  /** 걸린 시간: "바로"(0.1초 안), "0.2초", "7초", "1분 5초" */
  function durationWord(ms) {
    if (ms == null) return '';
    if (ms < 100) return '바로';
    if (ms < 1000) return (ms / 1000).toFixed(1) + '초';
    const s = Math.round(ms / 1000);
    return s < 60 ? s + '초' : Math.floor(s / 60) + '분' + (s % 60 ? ' ' + (s % 60) + '초' : '');
  }

  /** 엔진 점수 글에서 규칙(앞쪽 두 단계)을 다 지켰는지. 점수가 없으면 null. */
  function rulesKept(scoreString) {
    const m = /^\[([^\]]*)\]hard/.exec(scoreString || '');
    if (!m) return null;
    return m[1].split('/').every((v) => Number(v) === 0);
  }

  /**
   * 기록 한 줄 → 화면에 쓰는 말.
   * tone: ok(완료) · info(저장된 결과) · muted(중지·취소) · bad(실패) · warn(받지 않음)
   */
  function describe(row) {
    const st = row.status, reason = row.reason;
    let word, tone, note = '';
    if (st === 'DONE' && row.cached) { word = '저장된 결과'; tone = 'info'; note = '같은 조건으로 만든 결과를 다시 보여 줌'; }
    else if (st === 'DONE') { word = '완료'; tone = 'ok'; }
    else if (st === 'STOPPED' && reason === 'ABANDONED') { word = '취소됨'; tone = 'muted'; note = '차례를 기다리다 창이 닫힘'; }
    else if (st === 'STOPPED') { word = '중지'; tone = 'muted'; note = '사용자가 멈춤'; }
    else if (st === 'ERROR') { word = '실패'; tone = 'bad'; }
    else if (st === 'REJECTED') {
      word = '받지 않음'; tone = 'warn';
      note = row.httpStatus === 429 ? '이미 실행 중인 편성이 있었음' : row.httpStatus >= 500 ? '서버 오류' : '입력에 문제가 있었음';
    } else { word = st || '알 수 없음'; tone = 'muted'; }
    const kept = rulesKept(row.scoreString);
    const opt = row.options || {};
    const server = row.unattended || row.ip === 'server-default';
    return {
      time: timeOf(row.at),
      kind: row.mode === 'RESCHEDULE' ? '재편성' : '1차 편성',
      statusWord: word,
      tone,
      note,
      rules: kept == null ? '' : kept ? '규칙 모두 지킴' : '어긴 규칙 있음',
      rulesOk: kept,
      took: durationWord(row.elapsedMs),
      limit: opt.timeLimitSec ? '편성 시간 ' + opt.timeLimitSec + '초' : '',
      start: opt.mode === 'RESCHEDULE' ? '' : opt.init === 'SCRATCH' ? '처음부터 새로' : '지금 일정에서 이어서',
      who: server ? '서버(첫 화면 기본 결과)' : (row.ip || '알 수 없음'),
      server,
      error: row.error || '',
      resultUrl: row.resultId ? '/r/' + row.resultId : '',
      inputSize: row.inputBytes ? Math.max(1, Math.round(row.inputBytes / 1024)) + 'KB' : ''
    };
  }

  /** 하루 요약: 전체·완료·저장된 결과·중지·실패·받지 않음 수와 방문자 수 */
  function tally(entries) {
    const t = { all: entries.length, ok: 0, info: 0, muted: 0, bad: 0, warn: 0, visitors: 0 };
    const who = new Set();
    entries.forEach((e) => { t[describe(e).tone]++; if (!(e.unattended || e.ip === 'server-default')) who.add(e.ip); });
    t.visitors = who.size;
    return t;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.KBOAdmin = { offline, signIn, load, entry, download, describe, tally, timeOf, dayLabel, durationWord, rulesKept, esc };
})();
