#!/usr/bin/env python3
"""핵심판: 매뉴얼 원고(docs/manual/src-short/*.md)를 HTML 한 파일로 모으고 PDF를 만든다.

  python3 docs/manual/build-short/build.py    # manual-short.html · manual-short.pdf

외부 라이브러리 없이 원고에 쓰인 Markdown만 옮긴다(제목, 문단, 굵게, 표, 번호·점 목록과
그 밑 들여 쓴 줄, > 참고·주의 상자, [그림 n-m: …] 자리, ---).
목차 쪽 번호는 PDF를 한 번 만든 뒤 pdftotext로 제목이 놓인 쪽을 찾아 채우고 다시 만든다.
"""
import html, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'src-short')
IMG_REL = '../img-short/'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
CHAPTERS = ['00-cover', '01-what', '02-walkthrough', '03-conditions', '04-policy', '05-result', '06-compare', '07-when', '08-terms']


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    return s


def slug(prefix, n):
    return f'{prefix}-{n}'


class Conv:
    def __init__(self):
        self.toc = []   # (level, id, text)
        self.hid = 0
        self.missing = []

    def figure(self, m):
        num, desc = m.group(1), m.group(2)
        desc = re.sub(r'\s*·\s*\(전체판 fig-[\d-]+\)\s*$', '', desc)
        what, _, where = desc.rpartition(' · ')
        if not what:
            what, where = desc, ''
        path = os.path.join(HERE, '..', 'img-short', f'fig-{num}.png')
        if not os.path.exists(path):
            self.missing.append(num)
        cap = f'<span class="fn">그림 {num}</span> {inline(what)}'
        if where:
            cap += f' <span class="where">· {inline(where)}</span>'
        cls = 'fig'
        return (f'<figure class="{cls}" id="fig-{num}"><img src="{IMG_REL}fig-{num}.png" alt="그림 {num}: {html.escape(what)}">'
                f'<figcaption>{cap}</figcaption></figure>')

    def table(self, rows):
        cells = [[c.strip() for c in r.strip().strip('|').split('|')] for r in rows]
        head, body = cells[0], cells[2:]
        aligns = cells[1]
        out = ['<table>']
        if any(h for h in head):
            out.append('<thead><tr>' + ''.join(f'<th>{inline(h)}</th>' for h in head) + '</tr></thead>')
        out.append('<tbody>')
        for r in body:
            out.append('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>')
        out.append('</tbody></table>')
        cls = 'tbl'
        if len(head) == 2 and head[0].startswith('설정 상자'):
            cls += ' setbox'
        return f'<div class="{cls}">' + ''.join(out) + '</div>'

    def lists(self, lines):
        """번호/점 목록. 3칸 이상 들여 쓴 '- '는 그 위 항목의 화면 반응 줄."""
        ordered = bool(re.match(r'\d+\. ', lines[0]))
        tag = 'ol' if ordered else 'ul'
        start = int(re.match(r'(\d+)\.', lines[0]).group(1)) if ordered else 1
        items = []
        for ln in lines:
            m = re.match(r'(\d+)\. (.*)', ln) if ordered else re.match(r'- (.*)', ln)
            if m and not ln.startswith(' '):
                items.append([m.groups()[-1], []])
            else:
                sub = re.match(r'\s+- (.*)', ln)
                if sub:
                    items[-1][1].append(sub.group(1))
                else:
                    if items[-1][1]:
                        items[-1][1][-1] += ' ' + ln.strip()
                    else:
                        items[-1][0] += ' ' + ln.strip()
        attrs = f' start="{start}"' if ordered and start != 1 else ''
        out = [f'<{tag} class="{"steps" if ordered else "dots"}"{attrs}>']
        for text, subs in items:
            out.append(f'<li>{inline(text)}')
            if subs:
                out.append('<ul class="resp">' + ''.join(f'<li>{inline(s)}</li>' for s in subs) + '</ul>')
            out.append('</li>')
        out.append(f'</{tag}>')
        return ''.join(out)

    def quote(self, lines):
        text = ' '.join(l[1:].strip() for l in lines)
        kind = 'warn' if text.startswith('**주의**') else 'note'
        m = re.match(r'\*\*(참고|주의)\*\*\s*(.*)', text)
        label, body = (m.group(1), m.group(2)) if m else ('', text)
        return f'<aside class="box {kind}"><span class="lab">{label}</span>{inline(body)}</aside>'

    def convert(self, md, chap):
        lines = md.split('\n')
        out = []
        i = 0
        first_para = True
        while i < len(lines):
            ln = lines[i]
            if not ln.strip():
                i += 1
                continue
            m = re.match(r'(#{1,4}) (.*)', ln)
            if m:
                lvl, text = len(m.group(1)), m.group(2).strip()
                self.hid += 1
                hid = f'h{self.hid}'
                if lvl <= 2 and chap not in ('card',):
                    self.toc.append((lvl, hid, text))
                cls = ''
                out.append(f'<h{lvl} id="{hid}"{cls}>{inline(text)}</h{lvl}>')
                i += 1
                continue
            fm = re.match(r'^\[그림 (\d+): (.*)\]\s*$', ln)
            if fm:
                out.append(self.figure(fm))
                i += 1
                continue
            if ln.strip() == '---':
                out.append('<hr>')
                i += 1
                continue
            if ln.startswith('|'):
                rows = []
                while i < len(lines) and lines[i].startswith('|'):
                    rows.append(lines[i]); i += 1
                out.append(self.table(rows))
                continue
            if ln.startswith('>'):
                q = []
                while i < len(lines) and lines[i].startswith('>'):
                    q.append(lines[i]); i += 1
                out.append(self.quote(q))
                continue
            if re.match(r'(\d+\. |- )', ln):
                ls = []
                while i < len(lines) and lines[i].strip() and (re.match(r'(\d+\. |- |\s+)', lines[i])) and not lines[i].startswith('|'):
                    ls.append(lines[i]); i += 1
                out.append(self.lists(ls))
                continue
            # 문단
            para = []
            while i < len(lines) and lines[i].strip() and not re.match(r'(#{1,4} |\||>|\d+\. |- |---$|\[그림 )', lines[i]):
                para.append(lines[i].strip()); i += 1
            text = ' '.join(para)
            if text.startswith('**이 장에서 할 수 있는 일:**'):
                body = text[len('**이 장에서 할 수 있는 일:**'):].strip()
                out.append(f'<p class="lead"><span class="lab">이 장에서 할 수 있는 일</span>{inline(body)}</p>')
            else:
                out.append(f'<p>{inline(text)}</p>')
        return '\n'.join(out)


CSS = r'''
@page { size: A4; margin: 16mm 16mm 18mm 16mm;
  @bottom-center { content: counter(page); font: 9pt "Apple SD Gothic Neo", sans-serif; color: #6b7891; } }
@page cover { @bottom-center { content: none; } }
@page toc { @bottom-center { content: none; } }
:root { --ink: #14213d; --sub: #4a5874; --line: #cfd6e3; --blue: #1d4fbf; --orange: #c2540a; }
* { box-sizing: border-box; }
html { font-family: "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif; color: var(--ink); }
body { margin: 0; font-size: 10.5pt; line-height: 1.5; word-break: keep-all; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
strong { font-weight: 700; }
code { font-family: Menlo, monospace; font-size: 9pt; }
.chapter { break-before: auto; margin-top: 14mm; }
.toc h1 { font-size: 14pt; }
h1 { break-after: avoid; }
.lead { break-before: avoid; }
.toc + .chapter { margin-top: 0; }
.cover { padding-top: 6mm; }
.cover h1 { font-size: 26pt; line-height: 1.3; border: 0; margin: 0 0 4mm; padding: 0; }
.cover h1::before { content: none; }
.cover > p:first-of-type { font-size: 13pt; color: var(--sub); margin: 0 0 8mm; }
.cover h3 { margin-top: 6mm; }
.toc { margin-top: 10mm; break-inside: avoid; }
.toc h1 { border: 0; }
.toc ol { list-style: none; padding: 0; margin: 0; }
.toc li { display: flex; align-items: baseline; gap: 2mm; }
.toc li a { color: inherit; text-decoration: none; }
.toc li .dots { flex: 1; border-bottom: 1px dotted #aab3c5; transform: translateY(-3px); }
.toc li.l1 { font-weight: 700; font-size: 11pt; margin-top: 3.2mm; }
.toc li.l2 { font-size: 9.6pt; padding-left: 6mm; color: #2c3a57; line-height: 1.55; }
.toc .pg { min-width: 7mm; text-align: right; font-variant-numeric: tabular-nums; }
h1 { font-size: 20pt; line-height: 1.3; margin: 0 0 4mm; padding-bottom: 3mm; border-bottom: 2px solid var(--ink); }
h2 { font-size: 14pt; margin: 7mm 0 2.5mm; padding-top: 1mm; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 6mm 0 2mm; break-after: avoid; }
h4 { font-size: 10.5pt; margin: 4mm 0 1.5mm; break-after: avoid; }
p { margin: 0 0 2.6mm; orphans: 2; widows: 2; }
hr { border: 0; border-top: 1px solid var(--line); margin: 6mm 0; }
.lead { background: #eef3fc; border-left: 4px solid var(--blue); padding: 3mm 4mm; margin: 0 0 5mm; }
.lead .lab { display: block; font-weight: 700; color: var(--blue); font-size: 9.5pt; margin-bottom: 1mm; }
.tbl { margin: 3mm 0 4.5mm; }
table { width: 100%; border-collapse: collapse; font-size: 9.6pt; line-height: 1.5; }
th, td { border: 1px solid #b9c2d3; padding: 1.6mm 2.4mm; text-align: left; vertical-align: top; }
thead th { background: #edf1f7; font-weight: 700; }
tr { break-inside: avoid; }
.setbox table td:first-child, .setbox table th:first-child { width: 28mm; background: #f6f8fb; font-weight: 700; }
.setbox thead th { background: #1f2f52; color: #fff; }
.setbox thead th:first-child { background: #1f2f52; }
.cover table td:first-child { width: 28mm; background: #f6f8fb; font-weight: 700; }
ol.steps, ul.dots { margin: 1.5mm 0 3.5mm; padding-left: 7mm; }
ol.steps > li { margin: 0 0 1.6mm; padding-left: 1mm; }
ol.steps > li::marker { font-weight: 700; color: var(--blue); }
ul.dots > li { margin: 0 0 1mm; }
ul.resp { list-style: none; margin: 1mm 0 1mm; padding: 0 0 0 1mm; color: #34425f; font-size: 9.8pt; }
ul.resp > li { position: relative; padding-left: 5mm; margin: 0 0 .7mm; }
ul.resp > li::before { content: "→"; position: absolute; left: 0; color: #8a96ad; }
ul.dots ul.resp > li::before { content: "·"; }
.box { display: block; margin: 3.5mm 0 4.5mm; padding: 3mm 4mm; border-radius: 2mm; break-inside: avoid; font-size: 10pt; }
.box .lab { display: inline-block; font-weight: 700; margin-right: 2mm; padding: 0 2mm; border-radius: 1mm; font-size: 9pt; }
.box.note { background: #f4f6fa; border: 1px solid #d5dbe6; }
.box.note .lab { background: #dde4f0; color: #27365a; }
.box.warn { background: #fff5ec; border: 1px solid #f0b48a; }
.box.warn .lab { background: var(--orange); color: #fff; }
figure.fig { margin: 4mm 0 5mm; break-inside: avoid; text-align: center; }
figure.fig img { width: 60%; max-width: 100%; max-height: 110mm; object-fit: contain; border: 1px solid #c3cbda; border-radius: 1.5mm; }
figure#fig-1 img { border: 0; width: 70%; }
figure#fig-8 img { width: 40%; }
figure#fig-3 img, figure#fig-5 img { width: 70%; }
figure#fig-7 img, figure#fig-11 img, figure#fig-12 img { width: 100%; }
figcaption { margin-top: 1.6mm; font-size: 9pt; color: var(--sub); }
figcaption .fn { font-weight: 700; color: var(--ink); margin-right: 1mm; }
.card { break-before: page; }
.card h1 { font-size: 16pt; }
.card h2 { font-size: 12pt; margin-top: 5mm; }
.card table { font-size: 9pt; }
.card td:first-child { white-space: nowrap; }
.card p, .card li { font-size: 9.6pt; }
'''

CARD_CSS = CSS + r'''
@page { margin: 13mm 14mm 14mm; }
body { font-size: 9.6pt; line-height: 1.55; }
.card { break-before: auto; }
.card hr { margin: 3mm 0; }
.card h2 { margin: 3mm 0 2mm; }
'''


def page(title, body, css):
    return (f'<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<title>{html.escape(title)}</title>\n'
            f'<style>{css}</style>\n</head>\n<body>\n{body}\n</body>\n</html>\n')


def toc_html(toc, pages=None):
    rows = []
    for lvl, hid, text in toc:
        if lvl > 1:
            continue
        pg = pages.get(hid, '') if pages else ''
        rows.append(f'<li class="l{lvl}"><a href="#{hid}">{inline(text)}</a><span class="dots"></span><span class="pg">{pg}</span></li>')
    return '<section class="toc"><h1 id="toc">차례</h1><ol>' + ''.join(rows) + '</ol></section>'


def build_manual(pages=None):
    conv = Conv()
    parts = []
    for name in CHAPTERS:
        md = open(os.path.join(SRC, name + '.md'), encoding='utf-8').read()
        body = conv.convert(md, name)
        if name == '00-cover':
            parts.append(f'<section class="cover">{body}</section>')
            parts.append('@@TOC@@')
        else:
            parts.append(f'<section class="chapter" id="{name}">{body}</section>')
    toc = [t for t in conv.toc if not t[2].startswith('매치봇 스튜디오 운영 매뉴얼')]
    body = '\n'.join(parts).replace('@@TOC@@', toc_html(toc, pages))
    return page('매치봇 스튜디오 운영 매뉴얼 · 핵심판', body, CSS), toc, conv.missing


def pdf(src, out):
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                    '--generate-pdf-document-outline', '--allow-file-access-from-files',
                    f'--print-to-pdf={out}', 'file://' + os.path.abspath(src)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def page_texts(pdf_path):
    n = int(re.search(r'Pages:\s+(\d+)', subprocess.run(['pdfinfo', pdf_path], capture_output=True, text=True).stdout).group(1))
    texts = []
    for p in range(1, n + 1):
        t = subprocess.run(['pdftotext', '-f', str(p), '-l', str(p), '-layout', pdf_path, '-'], capture_output=True, text=True).stdout
        texts.append(t)
    return texts


def norm(s):
    return re.sub(r'\s+', '', re.sub(r'\*\*', '', s))


FIND = {}


def find_pages(toc, texts):
    """제목이 놓인 쪽. 모든 쪽 글을 이어 붙여, 차례 덩어리 뒤에서부터 제목을 차례로 찾는다."""
    joined, bounds = '', []
    for t in texts:
        joined += norm(t)
        bounds.append(len(joined))
    def page_of(pos):
        for i, b in enumerate(bounds):
            if pos < b:
                return i + 1
        return len(bounds)
    tops = [t for t in toc if t[0] == 1]
    # 차례 덩어리의 끝 = 마지막 장 제목이 처음 나온 곳
    pos = joined.find(norm(tops[-1][2]))
    pos = pos + 1 if pos >= 0 else 0
    pages = {}
    for lvl, hid, text in toc:
        k = joined.find(norm(FIND.get(text, text)), pos)
        if k >= 0:
            pages[hid] = page_of(k)
            pos = k + 1
    return pages


def main():
    out_html = os.path.join(HERE, 'manual-short.html')
    out_pdf = os.path.join(HERE, 'manual-short.pdf')
    doc, toc, missing = build_manual()
    open(out_html, 'w', encoding='utf-8').write(doc)
    pdf(out_html, out_pdf)
    pages = find_pages(toc, page_texts(out_pdf))
    doc, toc, missing = build_manual(pages)
    open(out_html, 'w', encoding='utf-8').write(doc)
    pdf(out_html, out_pdf)
    # 쪽 번호가 밀렸는지 한 번 더 확인
    pages2 = find_pages(toc, page_texts(out_pdf))
    if pages2 != pages:
        doc, toc, missing = build_manual(pages2)
        open(out_html, 'w', encoding='utf-8').write(doc)
        pdf(out_html, out_pdf)
        pages = pages2
    # 보고용: 장별 시작 쪽
    for lvl, hid, text in toc:
        if lvl == 1:
            print(f'{pages.get(hid, "?")}\t{text}')
    if missing:
        print('그림 없음:', ', '.join(missing))


if __name__ == '__main__':
    main()
