package org.optaplanner.examples.baseball.web;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.ParseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 엔진 호출 이력. 편성 요청 한 번(1차 편성·재편성, 캐시 적중·중지·실패·거절 포함)마다 한 줄씩 덧붙인다.
 * 파일은 한국 날짜별 {@code <dir>/YYYY-MM-DD.jsonl}, 한 줄이 JSON 하나다. 보낸 입력(problem)을 그대로 실어
 * 나중에 같은 편성을 다시 돌려 볼 수 있다. 결과 일정은 1차 편성이면 resultId(data/results/<id>.json),
 * 재편성은 저장소가 없으므로 줄에 plan을 함께 싣는다. 쓰기에 실패해도 편성은 막지 않는다.
 *
 * <pre>
 * { at, finishedAt, mode: INITIAL | RESCHEDULE, jobId, ip, unattended,
 *   status: DONE | STOPPED | ERROR | REJECTED, reason, cached, scoreString, elapsedMs, resultId?, plan?, error?,
 *   options, problem }
 * </pre>
 */
final class CallHistory {

    private static final Logger LOG = LoggerFactory.getLogger(CallHistory.class);
    static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final Pattern DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");
    /** 목록에서 빼는 큰 값. 한 건 보기(entry)에서만 준다. */
    private static final List<String> HEAVY = List.of("problem", "plan");

    private final Path dir;

    CallHistory(Path dir) throws IOException {
        this.dir = dir.toAbsolutePath().normalize();
        Files.createDirectories(this.dir);
    }

    Path fileFor(Instant at) {
        return dir.resolve(LocalDate.ofInstant(at, KST) + ".jsonl");
    }

    /** 작업이 끝났을 때(완료·중지·실패) 한 번. payload는 done 이벤트 내용, 실패면 null. */
    void finished(SolveJob job, String status, JSONObject payload, String error) {
        Instant now = Instant.now();
        JSONObject line = base(Instant.ofEpochMilli(job.createdAt), now, job.options.mode(), job.problem, job.options.toJson());
        line.put("jobId", job.id);
        line.put("ip", job.clientIp);
        line.put("unattended", job.unattended);
        line.put("status", status);
        line.put("elapsedMs", now.toEpochMilli() - job.createdAt);
        if (payload != null) {
            line.put("reason", payload.get("reason"));
            line.put("cached", Json.asBool(payload.get("cached"), false));
            if (payload.get("scoreString") != null) {
                line.put("scoreString", payload.get("scoreString"));
            }
            if (payload.get("id") != null) {
                line.put("resultId", payload.get("id"));
            } else if (SolveOptions.RESCHEDULE.equals(job.options.mode()) && payload.get("plan") != null) {
                line.put("plan", payload.get("plan"));
            }
        }
        if (error != null) {
            line.put("error", error);
        }
        append(line, now);
    }

    /** 큐에 넣기도 전에 거절한 요청(형식 오류·규칙 위반 400, 동시 실행 429). */
    void rejected(JSONObject problem, SolveOptions options, String ip, int httpStatus, String error) {
        Instant now = Instant.now();
        JSONObject line = base(now, now, options.mode(), problem, options.toJson());
        line.put("ip", ip);
        line.put("status", "REJECTED");
        line.put("httpStatus", (long) httpStatus);
        line.put("error", error);
        append(line, now);
    }

    private static JSONObject base(Instant at, Instant finishedAt, String mode, JSONObject problem, JSONObject options) {
        return Json.obj("at", at.toString(), "finishedAt", finishedAt.toString(), "mode", mode, "options", options,
                "problem", problem);
    }

    /** 이력이 있는 날짜, 최근 것부터. */
    JSONArray dates() throws IOException {
        List<String> out = new ArrayList<>();
        try (Stream<Path> files = Files.list(dir)) {
            files.map(f -> f.getFileName().toString())
                    .filter(n -> n.endsWith(".jsonl") && DATE.matcher(n.substring(0, n.length() - 6)).matches())
                    .map(n -> n.substring(0, n.length() - 6))
                    .sorted(java.util.Comparator.reverseOrder())
                    .forEach(out::add);
        }
        return Json.arr(out);
    }

    /** 그 날의 줄들, 입력·일정은 빼고 크기만 싣는다. index는 entry로 한 건을 다시 부를 때 쓴다. */
    JSONArray summaries(String date) throws IOException {
        JSONArray out = new JSONArray();
        List<String> lines = read(date);
        for (int i = 0; i < lines.size(); i++) {
            JSONObject line = parse(lines.get(i));
            if (line == null) {
                continue; // 쓰는 중이던 줄 등
            }
            JSONObject o = (JSONObject) line.clone();
            o.put("index", (long) i);
            o.put("inputBytes", (long) Json.str(line.get("problem")).length());
            HEAVY.forEach(o::remove);
            out.add(o);
        }
        return out;
    }

    /** 한 건 전체(보낸 입력 포함). 없거나 읽을 수 없으면 IllegalArgumentException(400). */
    JSONObject entry(String date, long index) throws IOException {
        List<String> lines = read(date);
        if (index < 0 || index >= lines.size()) {
            throw new IllegalArgumentException("그 기록이 없습니다.");
        }
        JSONObject line = parse(lines.get((int) index));
        if (line == null) {
            throw new IllegalArgumentException("그 기록을 읽을 수 없습니다.");
        }
        return line;
    }

    private List<String> read(String date) throws IOException {
        Path file = dir.resolve(checkDate(date) + ".jsonl");
        if (!Files.isRegularFile(file)) {
            return List.of();
        }
        synchronized (this) {
            return Files.readAllLines(file, StandardCharsets.UTF_8);
        }
    }

    static String checkDate(String date) {
        if (date == null || !DATE.matcher(date).matches()) {
            throw new IllegalArgumentException("날짜는 2026-11-12 모양으로 적어 주세요.");
        }
        try {
            LocalDate.parse(date);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("없는 날짜입니다: " + date);
        }
        return date;
    }

    private static JSONObject parse(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        try {
            return Json.object(Json.parse(line));
        } catch (ParseException | RuntimeException e) {
            return null;
        }
    }

    private synchronized void append(JSONObject line, Instant at) {
        try {
            Files.writeString(fileFor(at), Json.str(line) + "\n", StandardCharsets.UTF_8, StandardOpenOption.CREATE,
                    StandardOpenOption.APPEND);
        } catch (IOException | RuntimeException e) {
            LOG.warn("call history not written", e);
        }
    }
}
