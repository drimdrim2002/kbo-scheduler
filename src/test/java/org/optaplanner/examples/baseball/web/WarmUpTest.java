package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.Constants;

/** 서버가 켜질 때의 예열 편성: 작업 줄 맨 앞에 서고, 그동안 들어온 편성은 뒤에서 돌며, 결과를 남기지 않는다. */
class WarmUpTest {

    @Test
    void warmUpRunsFirstAndLeavesNoResult(@TempDir Path dir) throws Exception {
        ServerLimits limits = new ServerLimits(10, 300, 1, 1, 1, 200, 8 * 1024 * 1024);
        List<Runnable> runner = new ArrayList<>();
        JobManager jobs = new JobManager(limits, new ResultStore(dir), runner::add);
        JSONObject problem = BaseballApp.readJsonFile(Constants.inputFileName);

        jobs.warmUp(problem);
        SolveJob job = jobs.submit(problem, SolveOptions.from(Json.obj("timeLimitSec", 10L, "seed", 3L, "seeds", 1L,
                "init", "SCRATCH", "calcLimit", 5_000L), limits), "198.51.100.40");
        assertThat(runner).hasSize(2);

        runner.get(0).run(); // 예열
        assertThat(job.status()).isEqualTo(SolveJob.Status.QUEUED);
        try (var files = Files.list(dir)) {
            assertThat(files.toList()).as("warm-up saves nothing").isEmpty();
        }

        runner.get(1).run();
        assertThat(Json.object(job.statusJson().get("done"))).isNotNull();
    }
}
