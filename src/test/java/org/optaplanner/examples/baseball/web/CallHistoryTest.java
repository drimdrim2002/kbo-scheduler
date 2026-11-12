package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.Constants;

/** 엔진 호출 이력: 요청 한 번마다 한 줄, 보낸 입력을 그대로 싣고, 끝난 방식(완료·캐시·중지·거절)을 남긴다. */
class CallHistoryTest {

    private static List<JSONObject> lines(CallHistory history) throws Exception {
        Path file = history.fileFor(Instant.now());
        List<JSONObject> out = new ArrayList<>();
        if (!Files.exists(file)) {
            return out;
        }
        for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
            out.add(Json.object(Json.parse(line)));
        }
        return out;
    }

    private static SolveOptions reschedule(long seed) {
        return SolveOptions.from(Json.obj("mode", "RESCHEDULE", "timeLimitSec", 2L, "unimprovedSec", 1L, "seed", seed, "seeds", 2L),
                ServerLimits.defaults());
    }

    @Test
    void finishedAndCachedRunsKeepTheInputAndTheResult(@TempDir Path dir) throws Exception {
        CallHistory history = new CallHistory(dir.resolve("history"));
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, Runnable::run);
        jobs.history(history);
        JSONObject problem = RescheduleFixtures.problem(9, 30, "2025-09-01", "2025-09-28");

        SolveJob first = jobs.submit(problem, reschedule(1), "198.51.100.1");
        jobs.submit(problem, reschedule(1), "198.51.100.1");

        List<JSONObject> lines = lines(history);
        assertThat(lines).hasSize(2);
        JSONObject a = lines.get(0);
        assertThat(a.get("jobId")).isEqualTo(first.id);
        assertThat(a.get("ip")).isEqualTo("198.51.100.1");
        assertThat(a.get("mode")).isEqualTo("RESCHEDULE");
        assertThat(a.get("status")).isEqualTo("DONE");
        assertThat(a.get("cached")).isEqualTo(Boolean.FALSE);
        assertThat(a.get("scoreString")).isNotNull();
        assertThat(a).containsKeys("at", "finishedAt", "elapsedMs", "options", "plan");
        // 보낸 입력을 그대로 남긴다(다시 돌려 볼 수 있게)
        assertThat(Json.canonical(a.get("problem"))).isEqualTo(Json.canonical(problem));
        assertThat(lines.get(1).get("cached")).isEqualTo(Boolean.TRUE);
        assertThat(lines.get(1).get("status")).isEqualTo("DONE");
    }

    @Test
    void stoppedAndRejectedCallsAreRecordedOnce(@TempDir Path dir) throws Exception {
        CallHistory history = new CallHistory(dir.resolve("history"));
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, r -> { });
        jobs.history(history);
        JSONObject problem = BaseballApp.readJsonFile(Constants.inputFileName);
        SolveOptions options = SolveOptions.from(Json.obj("timeLimitSec", 1L, "seed", 7L, "seeds", 1L, "init", "SCRATCH"),
                ServerLimits.defaults());

        SolveJob queued = jobs.submit(problem, options, "198.51.100.2");
        assertThatThrownBy(() -> jobs.submit(problem, options, "198.51.100.2")).isInstanceOf(JobManager.RejectedException.class);
        jobs.stop(queued);
        jobs.stop(queued); // 두 번 멈춰도 한 줄
        JSONObject bad = RescheduleFixtures.problem(1, 0, "2025-08-30", "2025-09-20");
        assertThatThrownBy(() -> jobs.submit(bad, reschedule(1), "198.51.100.3")).isInstanceOf(IllegalArgumentException.class);

        List<JSONObject> lines = lines(history);
        assertThat(lines).extracting(l -> l.get("status")).containsExactly("REJECTED", "STOPPED", "REJECTED");
        assertThat(lines.get(0).get("httpStatus")).isEqualTo(429L);
        assertThat(lines.get(1).get("jobId")).isEqualTo(queued.id);
        assertThat(lines.get(1).get("reason")).isEqualTo("STOPPED");
        assertThat(lines.get(2).get("httpStatus")).isEqualTo(400L);
        assertThat((String) lines.get(2).get("error")).isNotBlank();
        assertThat(lines.get(2).get("problem")).isNotNull();
    }

    @Test
    void listLeavesOutTheInputAndOneEntryGivesItBack(@TempDir Path dir) throws Exception {
        CallHistory history = new CallHistory(dir.resolve("history"));
        JobManager jobs = new JobManager(ServerLimits.defaults(), null, r -> { });
        jobs.history(history);
        JSONObject bad = RescheduleFixtures.problem(1, 0, "2025-08-30", "2025-09-20");
        assertThatThrownBy(() -> jobs.submit(bad, reschedule(1), "198.51.100.4")).isInstanceOf(IllegalArgumentException.class);
        // 쓰다 만 줄은 건너뛴다
        Path file = history.fileFor(Instant.now());
        Files.writeString(file, "{\"at\":\"2026-", StandardCharsets.UTF_8, java.nio.file.StandardOpenOption.APPEND);
        String today = file.getFileName().toString().replace(".jsonl", "");

        assertThat(history.dates()).containsExactly(today);
        List<Object> list = history.summaries(today);
        assertThat(list).hasSize(1);
        JSONObject row = (JSONObject) list.get(0);
        assertThat(row).doesNotContainKeys("problem", "plan");
        assertThat(row.get("index")).isEqualTo(0L);
        assertThat((Long) row.get("inputBytes")).isPositive();
        assertThat(row.get("status")).isEqualTo("REJECTED");

        JSONObject full = history.entry(today, 0);
        assertThat(Json.canonical(full.get("problem"))).isEqualTo(Json.canonical(bad));
        assertThatThrownBy(() -> history.entry(today, 1)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> history.entry(today, 5)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> history.summaries("../results/x")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> history.summaries("2026-13-40")).isInstanceOf(IllegalArgumentException.class);
        assertThat(history.summaries("2020-01-01")).isEmpty();
    }
}
