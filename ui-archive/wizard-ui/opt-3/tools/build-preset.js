#!/usr/bin/env node
/*
 * input_2025.json → core/preset-2025.js
 * 사용법: node tools/build-preset.js <input_2025.json 경로>
 *   예) node tools/build-preset.js ../../data/baseball/input_2025.json
 * NFR-2: file:// 실행을 위해 프리셋을 fetch 대신 JS로 내장한다.
 */
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('사용법: node tools/build-preset.js <input_2025.json 경로>'); process.exit(1); }
const root = path.resolve(__dirname, '..');
const input = JSON.parse(fs.readFileSync(path.resolve(src), 'utf8'));
const strip = (o, keys) => { const r = {}; for (const k of keys) if (o[k] !== undefined) r[k] = o[k]; return r; };
const engine = {
  teams: input.teams.map((t) => strip(t, ['index', 'name', 'stadium', 'latitude', 'longitude'])),
  distanceMatrix: input.distanceMatrix.map((d) => strip(d, ['index', 'from', 'to', 'distance'])),
  calendar: input.calendar.map((c) => strip(c, ['index', 'datetime', 'consecutive', 'weekend', 'holiday'])),
  matches: input.matches.map((m) => strip(m, ['index', 'home', 'away', 'consecutive'])),
  initialPlan: input.initialPlan.map((p) => strip(p, ['index', 'datetime', 'home', 'away', 'consecutive', 'weekend', 'holiday']))
};
const rows = (arr) => '[\n' + arr.map((x) => '    ' + JSON.stringify(x)).join(',\n') + '\n  ]';
const body = Object.entries(engine).map(([k, v]) => '  ' + k + ': ' + rows(v)).join(',\n');
const header = fs.readFileSync(path.join(__dirname, 'preset-header.js'), 'utf8');
const out = header.replace('/*__ENGINE_INPUT__*/', '{\n' + body + '\n}');
fs.writeFileSync(path.join(root, 'core/preset-2025.js'), out);
console.log('wrote core/preset-2025.js', out.length, 'bytes');
