#!/usr/bin/env python3
"""SeedCountBench 결과 집계 → Markdown(docs/ENGINE_8SEED_BENCHMARK.md의 표).

    python3 scripts/seed-count-summary.py <outDir> > summary.md

읽는 것: <outDir>/groups.tsv, seeds.tsv, rounds.tsv, log-*.txt(솔버 INFO 로그의 점수 계산 속도).
"""
import csv
import glob
import math
import os
import re
import statistics
import sys
from collections import defaultdict

KINDS = [("four", "4갈래(한 번에 4)"), ("eight", "8갈래(4씩 두 판)"), ("atonce", "8갈래(이 컴퓨터에서 한 번에 8, 참고)")]
SCORE_RE = re.compile(r"\[(-?\d+)/(-?\d+)\]hard/\[(-?\d+)/(-?\d+)/(-?\d+)/(-?\d+)/(-?\d+)\]soft")


def score_tuple(s):
    m = SCORE_RE.fullmatch(s)
    if not m:
        raise ValueError(s)
    return tuple(int(x) for x in m.groups())


def read_tsv(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f, delimiter="\t"))


def km(v):
    return f"{v:,.0f}"


def stuck_note(t):
    """갇힘 표시: 허용 차이를 넘은 기준 이름(s1 이동 횟수, s2 이동 거리, s3 주말·공휴일)."""
    names = [(3, "이동 횟수"), (4, "이동 거리"), (5, "주말·공휴일")]
    over = [n for i, n in names if t[i] != 0]
    if t[2] != 0:
        over.insert(0, "미배정")
    return "·".join(over)


def group_table(rows):
    out = ["| 조건 | 묶음 | 규칙 위반 | 허용 차이 못 맞춤 | 전체 이동 거리 평균(km) | 가장 좋은 묶음 | 가장 나쁜 묶음 | 이동 횟수 격차 평균(회) | 이동 거리 격차 평균(km) | 주말·공휴일 격차 평균(점) |",
           "|---|---|---|---|---|---|---|---|---|---|"]
    for kind, name in KINDS:
        rs = [r for r in rows if r["kind"] == kind]
        if not rs:
            continue
        kms = [int(r["totalKm"]) for r in rs]
        stuck = sum(r["stuck"] == "true" for r in rs)
        hard_bad = sum(r["hardOk"] != "true" for r in rs)
        worst = min(rs, key=lambda r: score_tuple(r["score"]))
        wt = score_tuple(worst["score"])
        worst_txt = km(int(worst["totalKm"])) + (f" (못 맞춤: {stuck_note(wt)})" if worst["stuck"] == "true" else "")
        out.append(f"| {name} | {len(rs)} | {hard_bad} | {stuck}/{len(rs)} | {km(statistics.mean(kms))} | {km(min(kms))} | {worst_txt} | "
                   f"{statistics.mean(int(r['moveGap']) for r in rs):.1f} | {statistics.mean(float(r['distanceGapKm']) for r in rs):.0f} | "
                   f"{statistics.mean(int(r['holidayGap']) for r in rs):.1f} |")
    return out


def group_detail(rows):
    out = ["| 조건 | 묶음 | 고른 점수 | 전체 이동 거리(km) | 이동 횟수 격차 | 이동 거리 격차(km) | 주말·공휴일 격차(점) |", "|---|---|---|---|---|---|---|"]
    for kind, name in KINDS:
        for r in sorted((r for r in rows if r["kind"] == kind), key=lambda r: int(r["group"])):
            out.append(f"| {name} | {r['group']} | `{r['score']}` | {km(int(r['totalKm']))} | {r['moveGap']} | {r['distanceGapKm']} | {r['holidayGap']} |")
    return out


def order_stat(seeds, ks):
    """한 번씩 돈 결과 n개에서 k개를 무작위로 뽑아 최고를 고를 때의 정확한 기대값(모든 k-부분집합 평균).
    점수 내림차순 r번째(1부터)가 최고로 뽑힐 확률 = C(n-r, k-1) / C(n, k)."""
    ranked = sorted(seeds, key=lambda s: score_tuple(s["score"]), reverse=True)
    n = len(ranked)
    res = {}
    for k in ks:
        if k > n:
            continue
        total = math.comb(n, k)
        p = [math.comb(n - r, k - 1) / total for r in range(1, n + 1)]
        e_km = sum(pi * int(s["totalKm"]) for pi, s in zip(p, ranked))
        p_stuck = sum(pi for pi, s in zip(p, ranked) if s["stuck"] == "true")
        # 고른 결과의 전체 이동 거리가 이보다 나쁠 확률 10%(나쁜 쪽 90% 분위)
        dist = sorted(((int(s["totalKm"]), pi) for pi, s in zip(p, ranked)), reverse=True)
        acc, p90 = 0.0, None
        for v, pi in dist:
            acc += pi
            if acc >= 0.10:
                p90 = v
                break
        res[k] = (p_stuck, e_km, p90)
    return n, res


def speeds(out_dir):
    """로그에서 판마다 점수 계산 속도(회/초) 평균. 판 구분은 SeedCountBench의 '>>> round-start' 줄."""
    per = defaultdict(list)  # (label, seconds, kind) -> [round mean speed]
    for path in sorted(glob.glob(os.path.join(out_dir, "log-*.txt"))):
        m = re.search(r"log-(\d+)-(\d+)\.txt$", path)
        label, sec = m.group(1), m.group(2)
        kind, cur = None, []
        with open(path, encoding="utf-8", errors="replace") as f:
            for line in f:
                if line.startswith(">>>") and "round-start" in line:
                    kind, cur = line.split("round-start ")[1].split()[0], []
                elif line.startswith(">>>") and "round-end" in line:
                    if kind and kind != "warmup" and cur:
                        per[(label, sec, kind)].append(statistics.mean(cur))
                    kind = None
                elif kind and "Local Search phase" in line and "score calculation speed" in line:
                    cur.append(int(re.search(r"score calculation speed \((\d+)/sec\)", line).group(1)))
    return per


def main():
    out_dir = sys.argv[1]
    groups = read_tsv(os.path.join(out_dir, "groups.tsv"))
    seeds = read_tsv(os.path.join(out_dir, "seeds.tsv"))
    rounds = read_tsv(os.path.join(out_dir, "rounds.tsv"))
    sp = speeds(out_dir)
    conds = sorted({(r["label"], int(r["seconds"])) for r in groups}, key=lambda c: (c[1], c[0]))
    print("## 묶음별 결과(서로 다른 시드 묶음, 주 결과)\n")
    for label, sec in conds:
        rs = [r for r in groups if r["label"] == label and int(r["seconds"]) == sec]
        print(f"### {label} · {sec}초\n")
        print("\n".join(group_table(rs)))
        f = [int(r["totalKm"]) for r in rs if r["kind"] == "four"]
        e = [int(r["totalKm"]) for r in rs if r["kind"] == "eight"]
        if f and e:
            print(f"\n8갈래 − 4갈래 전체 이동 거리 평균: {statistics.mean(e) - statistics.mean(f):+,.0f}km\n")
    print("## 한 번씩 돈 결과 전체에서 계산한 기대값(보조)\n")
    print("4갈래·8갈래 판의 시드 결과(모두 4개씩 동시에 돈 것)를 한데 모아, k개를 무작위로 뽑아 최고를 고를 때의 정확한 기대값.\n")
    print("| 입력·시간 | 한 번씩 돈 결과 수 | k | 허용 차이 못 맞출 확률 | 전체 이동 거리 기대값(km) | 나쁜 쪽 10%(km) |")
    print("|---|---|---|---|---|---|")
    for label, sec in conds:
        ss = [s for s in seeds if s["label"] == label and int(s["seconds"]) == sec and s["kind"] in ("four", "eight")]
        n, res = order_stat(ss, [1, 2, 4, 8])
        for k, (ps, ekm, p90) in res.items():
            print(f"| {label} · {sec}초 | {n} | {k} | {ps * 100:.1f}% | {km(ekm)} | {km(p90)} |")
    print("\n## 공정성 점검: 판마다 점수 계산 속도(회/초, 시드 평균)와 시작 전 부하\n")
    print("| 입력·시간 | 조건 | 판 수 | 속도 평균 | 최저 | 최고 | 시작 전 다른 프로세스 CPU 평균(%) | 기다린 판 |")
    print("|---|---|---|---|---|---|---|---|")
    for label, sec in conds:
        for kind, name in KINDS:
            v = sp.get((label, str(sec), kind), [])
            rr = [r for r in rounds if r["label"] == label and int(r["seconds"]) == sec and r["kind"] == kind]
            if not v and not rr:
                continue
            cpu = statistics.mean(float(r["othersCpuBefore"]) for r in rr) if rr else float("nan")
            waited = sum(float(r["waitedSec"]) > 0 for r in rr)
            if v:
                print(f"| {label} · {sec}초 | {name} | {len(v)} | {statistics.mean(v):,.0f} | {min(v):,.0f} | {max(v):,.0f} | {cpu:.0f} | {waited} |")
    print("\n## 묶음별 상세\n")
    for label, sec in conds:
        rs = [r for r in groups if r["label"] == label and int(r["seconds"]) == sec]
        print(f"### {label} · {sec}초\n")
        print("\n".join(group_detail(rs)))
        print()


if __name__ == "__main__":
    main()
