#!/usr/bin/env node
/*
 * 2025 프리셋 프로젝트 JSON(설정·이벤트·연전 기간·시리즈·실제 1차 일정)을 파일로 쓴다.
 * 서버의 요구 사항 점검기(RequirementChecker)가 저장된 결과·기본 결과를 점검할 때 「정한 값」(휴식 요일·휴식기·개막전·어린이날…)을
 * 이 파일에서 읽는다. 엔진 입력(input_2025.json)에는 그 값이 없다.
 * 사용법: node ui/tools/build-project.js [출력 경로]   (기본 data/baseball/project_2025.json)
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
require(path.join(root, 'core/calendar-gen.js'));
require(path.join(root, 'core/preset-2025.js'));

const project = globalThis.KBO.Preset.buildProject();
delete project.meta.updatedAt;
delete project.games;
delete project.reschedule;
delete project.snapshots;

const out = process.argv[2] || path.resolve(root, '..', 'data', 'baseball', 'project_2025.json');
fs.writeFileSync(out, JSON.stringify(project, null, 1) + '\n');
console.log('wrote', out, fs.statSync(out).size, 'bytes');
