package org.optaplanner.examples.baseball.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import org.json.simple.JSONObject;

/** 한 번의 편성 요청. 상태와 마지막 이벤트를 들고 있다가 SSE 구독자에게 재생한다. */
final class SolveJob {

    enum Status { QUEUED, RUNNING, DONE, STOPPED, ERROR }

    record Event(String name, String data) {
    }

    final String id;
    final String cacheKey;
    final String clientIp;
    final JSONObject problem;
    final SolveOptions options;
    final long createdAt = System.currentTimeMillis();

    private Status status = Status.QUEUED;
    private int queuePosition;
    private Event lastBest;
    private final Map<Long, Event> lastSeedBest = new LinkedHashMap<>();
    private Event terminal;
    private final List<BlockingQueue<Event>> subscribers = new ArrayList<>();
    volatile MultiStartSolver solver;
    volatile boolean stopRequested;
    /** 끝났을 때 한 번 부른다(기본 결과 저장 등). 캐시 적중이면 submit이 바로 부른다. */
    volatile java.util.function.Consumer<JSONObject> onDone;

    SolveJob(String id, String cacheKey, String clientIp, JSONObject problem, SolveOptions options) {
        this.id = id;
        this.cacheKey = cacheKey;
        this.clientIp = clientIp;
        this.problem = problem;
        this.options = options;
    }

    synchronized Status status() {
        return status;
    }

    synchronized boolean isFinished() {
        return status == Status.DONE || status == Status.STOPPED || status == Status.ERROR;
    }

    synchronized void queued(int position) {
        queuePosition = position;
        if (status == Status.QUEUED) {
            publish(new Event("queued", Json.str(Json.obj("jobId", id, "position", (long) position))));
        }
    }

    synchronized void running() {
        status = Status.RUNNING;
        publish(new Event("status", Json.str(Json.obj("jobId", id, "status", "RUNNING"))));
    }

    synchronized void seedBest(JSONObject payload) {
        Event e = new Event("seed-best", Json.str(payload));
        lastSeedBest.put(Json.asLong(payload.get("seed"), -1), e);
        publish(e);
    }

    synchronized void best(JSONObject payload) {
        lastBest = new Event("best", Json.str(payload));
        publish(lastBest);
    }

    synchronized void done(JSONObject payload, boolean stopped) {
        status = stopped ? Status.STOPPED : Status.DONE;
        terminal = new Event("done", Json.str(payload));
        publish(terminal);
        subscribers.clear();
    }

    synchronized void error(String message) {
        status = Status.ERROR;
        terminal = new Event("error", Json.str(Json.obj("jobId", id, "message", message)));
        publish(terminal);
        subscribers.clear();
    }

    /** 현재 상태를 먼저 재생하고 이후 이벤트를 받는 큐를 돌려준다. */
    synchronized BlockingQueue<Event> subscribe() {
        BlockingQueue<Event> q = new LinkedBlockingQueue<>();
        if (status == Status.QUEUED) {
            q.add(new Event("queued", Json.str(Json.obj("jobId", id, "position", (long) queuePosition))));
        } else if (status == Status.RUNNING) {
            q.add(new Event("status", Json.str(Json.obj("jobId", id, "status", "RUNNING"))));
        }
        q.addAll(lastSeedBest.values());
        if (lastBest != null) {
            q.add(lastBest);
        }
        if (terminal != null) {
            q.add(terminal);
        } else {
            subscribers.add(q);
        }
        return q;
    }

    synchronized void unsubscribe(BlockingQueue<Event> q) {
        subscribers.remove(q);
    }

    private void publish(Event e) {
        for (BlockingQueue<Event> q : subscribers) {
            q.offer(e);
        }
    }

    /** GET /api/v1/solve/{jobId} 응답. */
    synchronized JSONObject statusJson() {
        JSONObject o = Json.obj("jobId", id, "status", status.name());
        if (status == Status.QUEUED) {
            o.put("position", (long) queuePosition);
        }
        if (lastBest != null) {
            try {
                o.put("best", Json.parse(lastBest.data()));
            } catch (org.json.simple.parser.ParseException ignored) {
                // 직접 만든 JSON이라 실패하지 않는다
            }
        }
        if (terminal != null) {
            try {
                o.put(terminal.name(), Json.parse(terminal.data()));
            } catch (org.json.simple.parser.ParseException ignored) {
                // 위와 같다
            }
        }
        return o;
    }
}
