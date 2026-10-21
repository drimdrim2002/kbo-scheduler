#!/usr/bin/env python3
"""「편성 시작」 동시 N명 부하 시험(docs/LOAD_TEST.md). 표준 라이브러리만 쓴다.

서버 안에서: python3 loadtest.py --base http://127.0.0.1:8080 --clients 10 --problem problem.json
  방문자마다 X-Real-IP를 다르게 보낸다(서버는 루프백에서 온 X-Real-IP만 믿는다).
Cloudflare 경유: python3 loadtest.py --base https://schedulelab.kr --clients 1 --no-fake-ip ...
  한 주소에서는 동시 1작업이라 1명만 보낸다.

problem.json 만들기(저장소 루트): node -e "process.stdout.write(JSON.stringify(require('./ui/core/preset-2025.js').Preset.buildProject()))" > problem.json
시드가 같으면 캐시에서 바로 돌려주므로, 실행마다 다른 --seed-base를 쓴다(기본: 현재 시각).
"""
import argparse
import json
import os
import threading
import time
import urllib.error
import urllib.request


def now():
    return time.monotonic()


class Client(threading.Thread):
    def __init__(self, idx, args, body, t0):
        super().__init__(daemon=True)
        self.idx, self.args, self.body, self.t0 = idx, args, body, t0
        self.r = {"client": idx, "positions": [], "events": {}, "keepalives": 0, "error": None}

    def headers(self):
        h = {"Content-Type": "application/json", "User-Agent": "kbo-loadtest"}
        if not self.args.no_fake_ip:
            h["X-Real-IP"] = "198.51.100.%d" % (10 + self.idx)
        return h

    def run(self):
        r = self.r
        time.sleep(self.idx * self.args.stagger)
        start = now()
        r["startAt"] = round(start - self.t0, 2)
        try:
            req = urllib.request.Request(self.args.base + "/api/v1/solve", data=self.body, headers=self.headers())
            with urllib.request.urlopen(req, timeout=30) as resp:
                r["http"] = resp.status
                job = json.load(resp)
            r["postMs"] = round((now() - start) * 1000)
            r["jobId"] = job.get("jobId")
            self.stream(job["jobId"], start)
        except urllib.error.HTTPError as e:
            r["http"] = e.code
            r["error"] = "HTTP %d %s" % (e.code, e.read().decode("utf-8", "replace")[:120])
        except Exception as e:  # 연결 끊김·시간 초과
            r["error"] = "%s: %s" % (type(e).__name__, e)
        r["totalSec"] = round(now() - start, 1)

    def stream(self, job_id, start):
        r = self.r
        req = urllib.request.Request(self.args.base + "/api/v1/solve/%s/events" % job_id, headers=self.headers())
        with urllib.request.urlopen(req, timeout=self.args.read_timeout) as resp:
            name, last = None, now()
            for raw in resp:
                line = raw.decode("utf-8", "replace").rstrip("\r\n")
                t = now()
                r["maxGapSec"] = round(max(r.get("maxGapSec", 0), t - last), 1)
                last = t
                if line.startswith(":"):
                    r["keepalives"] += 1
                elif line.startswith("event:"):
                    name = line[6:].strip()
                elif line.startswith("data:") and name:
                    sec = round(t - start, 1)
                    r.setdefault("firstEventSec", sec)
                    r["events"].setdefault(name, sec)
                    data = json.loads(line[5:])
                    if name == "queued":
                        r["positions"].append(data.get("position"))
                    elif name == "status":
                        r["runningAtSec"] = sec
                    elif name == "done":
                        r["doneSec"] = sec
                        r["resultId"] = data.get("id")
                        r["reason"] = data.get("reason")
                        return
                    elif name == "error":
                        r["error"] = "event error: " + str(data.get("message"))
                        return
                    name = None
        if "doneSec" not in r:
            r["error"] = r["error"] or "stream ended without done"


class Sampler(threading.Thread):
    """리눅스(서버)에서만: 전체 CPU 사용률, 사용 메모리, java RSS를 1초마다 잰다."""

    def __init__(self):
        super().__init__(daemon=True)
        self.samples, self.stop_flag = [], False

    @staticmethod
    def cpu():
        with open("/proc/stat") as f:
            v = [int(x) for x in f.readline().split()[1:]]
        idle = v[3] + v[4]
        return sum(v), idle

    @staticmethod
    def mem_used_mb():
        m = {}
        with open("/proc/meminfo") as f:
            for line in f:
                k, val = line.split(":")
                m[k] = int(val.split()[0])
        return (m["MemTotal"] - m["MemAvailable"]) // 1024

    @staticmethod
    def java_rss_mb():
        best = 0
        for pid in os.listdir("/proc"):
            if not pid.isdigit():
                continue
            try:
                with open("/proc/%s/cmdline" % pid, "rb") as f:
                    if b"BaseballWebServer" not in f.read():
                        continue
                with open("/proc/%s/status" % pid) as f:
                    for line in f:
                        if line.startswith("VmRSS:"):
                            best = max(best, int(line.split()[1]) // 1024)
            except OSError:
                pass
        return best

    def run(self):
        tot0, idle0 = self.cpu()
        while not self.stop_flag:
            time.sleep(1)
            tot, idle = self.cpu()
            busy = 100.0 * (1 - (idle - idle0) / max(1, tot - tot0))
            tot0, idle0 = tot, idle
            self.samples.append((round(busy), self.mem_used_mb(), self.java_rss_mb()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8080")
    ap.add_argument("--clients", type=int, default=10)
    ap.add_argument("--problem", default="problem.json")
    ap.add_argument("--time", type=int, default=10, help="timeLimitSec")
    ap.add_argument("--seed-base", type=int, default=int(time.time()) % 100000000 * 10)
    ap.add_argument("--stagger", type=float, default=0.2, help="요청 사이 간격(초)")
    ap.add_argument("--read-timeout", type=float, default=300)
    ap.add_argument("--no-fake-ip", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    with open(args.problem, encoding="utf-8") as f:
        problem = json.load(f)
    sampler = Sampler() if os.path.exists("/proc/stat") else None
    if sampler:
        sampler.start()
    t0 = now()
    clients = []
    for i in range(args.clients):
        options = {"timeLimitSec": args.time, "init": "SCRATCH", "seed": args.seed_base + i * 1000}
        body = json.dumps({"problem": problem, "options": options, "mode": "INITIAL"}).encode("utf-8")
        c = Client(i, args, body, t0)
        clients.append(c)
        c.start()
    for c in clients:
        c.join()
    wall = round(now() - t0, 1)
    if sampler:
        sampler.stop_flag = True
        sampler.join(2)

    rows = [c.r for c in clients]
    print("client http post_ms first_ev positions          running done   gap_max keepalive error")
    for r in rows:
        pos = ",".join(str(p) for p in r["positions"]) or "-"
        print("%6d %4s %7s %8s %-19s %7s %6s %7s %9d %s" % (
            r["client"], r.get("http", "-"), r.get("postMs", "-"), r.get("firstEventSec", "-"), pos[:19],
            r.get("runningAtSec", "-"), r.get("doneSec", "-"), r.get("maxGapSec", "-"), r["keepalives"], r["error"] or ""))
    done = [r["doneSec"] for r in rows if "doneSec" in r]
    summary = {"clients": args.clients, "timeLimitSec": args.time, "wallSec": wall, "ok": len(done),
               "failed": len(rows) - len(done), "doneMin": min(done, default=None), "doneMax": max(done, default=None),
               "waitMax": max((r.get("runningAtSec", 0) for r in rows), default=None)}
    if sampler and sampler.samples:
        s = sampler.samples
        summary.update(cpuAvg=round(sum(x[0] for x in s) / len(s)), cpuMax=max(x[0] for x in s),
                       memUsedMaxMb=max(x[1] for x in s), javaRssMaxMb=max(x[2] for x in s))
    print(json.dumps(summary, ensure_ascii=False))
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump({"summary": summary, "clients": rows, "samples": sampler.samples if sampler else []}, f,
                      ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
