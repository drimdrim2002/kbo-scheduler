/*
 * KBO 공통 코어 — 작은 엑셀(.xlsx) 읽기·쓰기. 바깥 라이브러리 없이 zip + XML만 다룬다.
 * 쓰기: 시트마다 줄 목록 → .xlsx 바이트(압축 없이 담는 zip). 글자·숫자·날짜(엑셀 날짜 일련번호 + 날짜 서식)·수식(+ 계산해 둔 값)·굵은 제목 줄·열 너비.
 * 읽기: 엑셀·구글 시트·Numbers가 저장한 .xlsx(deflate 압축 zip)를 시트마다 줄 목록으로. 공유 문자열·인라인 문자열·숫자·참거짓·수식의 계산된 값.
 *   압축 풀기(raw deflate)는 밖에서 넘긴다: 브라우저는 DecompressionStream('deflate-raw'), Node는 zlib.inflateRawSync.
 * 날짜 칸은 숫자(일련번호)로 읽히므로 받는 쪽이 serialToIso로 바꾼다. DOM에 의존하지 않는다.
 */
(function (root, factory) {
  const KBO = root.KBO || (root.KBO = {});
  (KBO.__factories || (KBO.__factories = {})).xlsx = factory;
  factory(KBO);
  if (typeof module !== 'undefined' && module.exports) module.exports = KBO;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (KBO) {
  'use strict';

  // ───────── 날짜: 엑셀 일련번호(1900 날짜 체계, 1899-12-30 = 0) ─────────
  const DAY_MS = 86400000;
  const EPOCH = Date.UTC(1899, 11, 30) / DAY_MS;
  function isoToSerial(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS - EPOCH : null; }
  function serialToIso(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null;
    const d = new Date((Math.floor(n) + EPOCH) * DAY_MS);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }

  // ───────── 글자 ─────────
  const enc = (s) => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s) : Uint8Array.from(Buffer.from(s, 'utf8')));
  const dec = (b) => (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8').decode(b) : Buffer.from(b).toString('utf8'));
  const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  function xmlUnesc(s) {
    return String(s).replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
    });
  }
  /** A1 칸 이름 ↔ (열 번호 0부터, 줄 번호 0부터) */
  function colName(i) { let s = ''; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; }
  function cellPos(ref) { const m = /^([A-Z]+)(\d+)$/.exec(ref || ''); if (!m) return null; let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; return { c: c - 1, r: +m[2] - 1 }; }

  // ───────── zip ─────────
  let CRC = null;
  function crc32(b) {
    if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    let c = 0xFFFFFFFF;
    for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  /** files: [{ name, data(Uint8Array) }] → 압축 없이 담은 zip */
  function zipStore(files) {
    const parts = [], central = [];
    let off = 0;
    for (const f of files) {
      const name = enc(f.name), crc = crc32(f.data), n = f.data.length;
      const lh = new Uint8Array(30 + name.length), lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true);
      lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true); lv.setUint32(14, crc, true); lv.setUint32(18, n, true); lv.setUint32(22, n, true);
      lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true); lh.set(name, 30);
      parts.push(lh, f.data);
      const ch = new Uint8Array(46 + name.length), cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
      cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true); cv.setUint32(16, crc, true); cv.setUint32(20, n, true); cv.setUint32(24, n, true);
      cv.setUint16(28, name.length, true); cv.setUint32(42, off, true); ch.set(name, 46);
      central.push(ch);
      off += lh.length + n;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new Uint8Array(22), ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true); ev.setUint32(12, cdSize, true); ev.setUint32(16, off, true);
    const all = parts.concat(central, [end]), out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
    let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
    return out;
  }
  /** zip → { 이름: 압축된 바이트와 방식 } (끝의 중앙 목록을 읽는다) */
  function zipEntries(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('엑셀(.xlsx) 파일이 아닙니다 — zip 끝 표시를 찾지 못했습니다.');
    const count = v.getUint16(e + 10, true);
    let p = v.getUint32(e + 16, true);
    const out = {};
    for (let k = 0; k < count; k++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('엑셀(.xlsx) 파일의 목록이 깨졌습니다.');
      const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true), xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), loff = v.getUint32(p + 42, true);
      const name = dec(b.subarray(p + 46, p + 46 + nlen));
      const data = loff + 30 + v.getUint16(loff + 26, true) + v.getUint16(loff + 28, true);
      out[name] = { method, data: b.subarray(data, data + csize) };
      p += 46 + nlen + xlen + clen;
    }
    return out;
  }

  // ───────── 쓰기 ─────────
  // 서식: 0 기본 · 1 날짜(yyyy-mm-dd) · 2 굵은 제목 · 3 날짜 + 회색(수식 칸) · 4 회색(수식 칸)
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>' +
    '<fonts count="3"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font><font><sz val="11"/><color rgb="FF5F697D"/><name val="맑은 고딕"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF1FD"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="2" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  /**
   * 칸 값: 글자 · 숫자 · null(빈 칸) · { date:'YYYY-MM-DD' } · { f:'수식', v:계산해 둔 값(글자·숫자·{date}) }.
   * 첫 줄은 굵은 제목(header: true일 때).
   */
  function cellXml(ref, x, head) {
    if (x == null || x === '') return '';
    if (typeof x === 'object' && x.f) {
      const v = x.v, isDate = v && typeof v === 'object' && v.date;
      const val = isDate ? isoToSerial(v.date) : v;
      if (typeof val === 'number') return '<c r="' + ref + '" s="' + (isDate ? 3 : 4) + '"><f>' + xmlEsc(x.f) + '</f><v>' + val + '</v></c>';
      return '<c r="' + ref + '" s="4" t="str"><f>' + xmlEsc(x.f) + '</f><v>' + xmlEsc(val == null ? '' : val) + '</v></c>';
    }
    if (typeof x === 'object' && x.date) { const n = isoToSerial(x.date); return n == null ? '' : '<c r="' + ref + '" s="1"><v>' + n + '</v></c>'; }
    if (typeof x === 'number' && Number.isFinite(x)) return '<c r="' + ref + '"' + (head ? ' s="2"' : '') + '><v>' + x + '</v></c>';
    if (typeof x === 'boolean') return '<c r="' + ref + '" t="b"><v>' + (x ? 1 : 0) + '</v></c>';
    return '<c r="' + ref + '" t="inlineStr"' + (head ? ' s="2"' : '') + '><is><t xml:space="preserve">' + xmlEsc(x) + '</t></is></c>';
  }
  function sheetXml(sh) {
    const rows = sh.rows || [];
    const cols = sh.widths && sh.widths.length ? '<cols>' + sh.widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join('') + '</cols>' : '';
    const pane = sh.header ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' : '';
    const body = rows.map((r, ri) => '<row r="' + (ri + 1) + '">' + (r || []).map((x, ci) => cellXml(colName(ci) + (ri + 1), x, sh.header && ri === 0)).join('') + '</row>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + pane + cols + '<sheetData>' + body + '</sheetData></worksheet>';
  }
  /** sheets: [{ name, rows: [[칸…]…], header, widths }] → Uint8Array(.xlsx) */
  function write(sheets) {
    const n = sheets.length;
    const files = [
      { name: '[Content_Types].xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') + '</Types>' },
      { name: '_rels/.rels', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView/></bookViews><sheets>' + sheets.map((s, i) => '<sheet name="' + xmlEsc(String(s.name).slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') + '</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') + '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: 'xl/styles.xml', xml: STYLES }
    ].concat(sheets.map((s, i) => ({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', xml: sheetXml(s) })));
    return zipStore(files.map((f) => ({ name: f.name, data: enc(f.xml) })));
  }

  // ───────── 읽기 ─────────
  const attr = (tag, name) => { const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag); return m ? xmlUnesc(m[1]) : null; };
  const textOf = (xml) => { let s = ''; const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g; let m; while ((m = re.exec(xml))) s += m[1] ? xmlUnesc(m[1]) : ''; return s; };
  /** 시트 XML → 줄 목록(빈 칸은 null, 끝의 빈 칸·빈 줄은 뺀다) */
  function parseSheet(xml, shared) {
    const rows = [];
    const sd = /<sheetData[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
    if (!sd) return rows;
    const cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let m, auto = 0;
    const rre = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g;
    let rm;
    while ((rm = rre.exec(sd[1]))) {
      const rn = attr(rm[1], 'r'), ri = rn ? +rn - 1 : auto;
      auto = ri + 1;
      const row = [];
      let ci = 0;
      cre.lastIndex = 0;
      const inner = rm[2] || '';
      while ((m = cre.exec(inner))) {
        const tag = m[1], body = m[2] || '';
        const p = cellPos(attr(tag, 'r'));
        const c = p ? p.c : ci;
        ci = c + 1;
        const t = attr(tag, 't');
        const vm = /<v>([\s\S]*?)<\/v>/.exec(body);
        let val = null;
        if (t === 's') val = vm ? (shared[+vm[1]] != null ? shared[+vm[1]] : '') : null;
        else if (t === 'inlineStr') val = textOf((/<is>([\s\S]*?)<\/is>/.exec(body) || [])[1] || '');
        else if (t === 'str' || t === 'e') val = vm ? xmlUnesc(vm[1]) : null;
        else if (t === 'b') val = vm ? vm[1] === '1' : null;
        else if (vm) { const n = Number(vm[1]); val = Number.isFinite(n) ? n : xmlUnesc(vm[1]); }
        row[c] = val === '' ? null : val;
      }
      for (let k = 0; k < row.length; k++) if (row[k] === undefined) row[k] = null;
      while (row.length && row[row.length - 1] == null) row.pop();
      rows[ri] = row;
    }
    for (let k = 0; k < rows.length; k++) if (!rows[k]) rows[k] = [];
    while (rows.length && !rows[rows.length - 1].length) rows.pop();
    return rows;
  }
  /**
   * bytes(.xlsx) → Promise<[{ name, rows }]> (시트 순서대로).
   * inflateRaw(Uint8Array) → Uint8Array 또는 Promise<Uint8Array>: 압축된 항목을 푼다.
   */
  async function read(bytes, inflateRaw) {
    const ents = zipEntries(bytes);
    const get = async (name) => {
      const e = ents[name] || ents[Object.keys(ents).find((k) => k.toLowerCase() === name.toLowerCase())];
      if (!e) return null;
      if (e.method === 0) return dec(e.data);
      if (e.method === 8) { if (!inflateRaw) throw new Error('압축을 풀 수 없습니다.'); return dec(await inflateRaw(e.data)); }
      throw new Error('지원하지 않는 압축 방식(' + e.method + ')입니다.');
    };
    const wb = await get('xl/workbook.xml');
    if (!wb) throw new Error('엑셀(.xlsx) 통합 문서가 아닙니다(xl/workbook.xml 없음).');
    const rels = (await get('xl/_rels/workbook.xml.rels')) || '';
    const relMap = {};
    rels.replace(/<Relationship\b([^>]*)\/?>/g, (m0, a) => { relMap[attr(a, 'Id')] = attr(a, 'Target'); return m0; });
    const sst = await get('xl/sharedStrings.xml');
    const shared = [];
    if (sst) sst.replace(/<si>([\s\S]*?)<\/si>/g, (m0, si) => { shared.push(textOf(si)); return m0; });
    const out = [];
    const sheetTags = wb.match(/<sheet\b[^>]*\/?>/g) || [];
    for (const tag of sheetTags) {
      const name = attr(tag, 'name'), rid = attr(tag, 'r:id');
      let target = relMap[rid] || '';
      target = target.replace(/^\//, '');
      if (!/^xl\//.test(target)) target = 'xl/' + target;
      const xml = await get(target);
      out.push({ name, rows: xml ? parseSheet(xml, shared) : [] });
    }
    return out;
  }

  KBO.Xlsx = { write, read, zipStore, zipEntries, crc32, isoToSerial, serialToIso, colName, cellPos };
});
