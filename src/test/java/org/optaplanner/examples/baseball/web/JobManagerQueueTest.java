package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.BlockingQueue;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.Constants;

/**
 * 대기 줄: 아무도 지켜보지 않는 대기 작업(탭 닫기·연결 끊김)은 빼고, 대기 중 중지는 IP 몫을 바로 돌려준다.
 * runner가 작업을 실제로 돌리지 않아 모든 작업이 대기 상태로 남는다.
 */
class JobManagerQueueTest {

    private final List<Runnable> runnerTasks = new ArrayList<>();
    private JobManager jobs;
    private JSONObject problem;
    private long seed = 1000;

    @BeforeEach
    void setUp() {
        jobs = new JobManager(ServerLimits.defaults(), null, runnerTasks::add);
        problem = BaseballApp.readJsonFile(Constants.inputFileName);
    }

    private SolveJob submit(String ip) {
        SolveOptions options = SolveOptions.from(Json.obj("timeLimitSec", 1L, "seed", seed++, "seeds", 1L, "init", "SCRATCH"),
                ServerLimits.defaults());
        return jobs.submit(problem, options, ip);
    }

    private static String reason(SolveJob job) throws Exception {
        return (String) Json.object(job.statusJson().get("done")).get("reason");
    }

    @Test
    void stoppingQueuedJobFreesIpAtOnce() throws Exception {
        SolveJob a = submit("198.51.100.1");
        SolveJob b = submit("198.51.100.2");
        assertThatThrownBy(() -> submit("198.51.100.2")).isInstanceOf(JobManager.RejectedException.class);

        jobs.stop(b);

        assertThat(b.status()).isEqualTo(SolveJob.Status.STOPPED);
        assertThat(reason(b)).isEqualTo("STOPPED");
        assertThat(jobs.queueLength()).isEqualTo(1);
        // 예전에는 b의 차례가 올 때까지 429였다
        assertThat(submit("198.51.100.2").status()).isEqualTo(SolveJob.Status.QUEUED);
        assertThat(a.status()).isEqualTo(SolveJob.Status.QUEUED);
    }

    @Test
    void sweepDropsUnwatchedQueuedJobsAndKeepsWatchedOnes() throws Exception {
        SolveJob watched = submit("198.51.100.1");
        SolveJob left = submit("198.51.100.2");
        SolveJob neverOpened = submit("198.51.100.3");
        BlockingQueue<SolveJob.Event> sse = watched.subscribe();
        left.unsubscribe(left.subscribe());
        long now = System.currentTimeMillis();

        jobs.sweep(now + JobManager.ABANDON_MS - 1000);
        assertThat(jobs.queueLength()).isEqualTo(3);

        jobs.sweep(now + JobManager.ABANDON_MS + 1000);
        assertThat(jobs.queueLength()).isEqualTo(1);
        assertThat(watched.status()).isEqualTo(SolveJob.Status.QUEUED);
        assertThat(reason(left)).isEqualTo("ABANDONED");
        assertThat(reason(neverOpened)).isEqualTo("ABANDONED");
        // 남은 사람의 순번이 바로 줄었다는 소식은 SSE로 간다(재생된 1번째 그대로)
        assertThat(sse).extracting(SolveJob.Event::name).contains("queued");
        // 빠진 작업의 주소는 다시 낼 수 있다
        submit("198.51.100.2");
        submit("198.51.100.3");
        assertThat(jobs.queueLength()).isEqualTo(3);
    }

    @Test
    void unattendedServerJobIsNeverDropped() {
        SolveOptions options = SolveOptions.from(Json.obj("timeLimitSec", 1L, "seed", 42L, "seeds", 1L, "init", "SCRATCH"),
                ServerLimits.defaults());
        SolveJob server = jobs.submit(problem, options, "server-default", true);

        jobs.sweep(System.currentTimeMillis() + JobManager.ABANDON_MS * 10);

        assertThat(server.status()).isEqualTo(SolveJob.Status.QUEUED);
    }

    @Test
    void retryFromSameAddressTakesOverUnwatchedPlace() throws Exception {
        submit("198.51.100.1");
        SolveJob first = submit("198.51.100.2");
        SolveJob behind = submit("198.51.100.3");
        BlockingQueue<SolveJob.Event> behindSse = behind.subscribe();
        // 지켜보는 중이면 그대로 429
        BlockingQueue<SolveJob.Event> firstSse = first.subscribe();
        assertThatThrownBy(() -> submit("198.51.100.2")).isInstanceOf(JobManager.RejectedException.class);
        first.unsubscribe(firstSse);
        Thread.sleep(JobManager.RETRY_ABANDON_MS + 100);

        SolveJob retry = submit("198.51.100.2");

        assertThat(reason(first)).isEqualTo("ABANDONED");
        // 맨 뒤가 아니라 앞 작업의 자리(2번째)를 이어받는다
        assertThat(retry.statusJson().get("position")).isEqualTo(2L);
        assertThat(behind.statusJson().get("position")).isEqualTo(3L);
        assertThat(behindSse).extracting(SolveJob.Event::name).containsOnly("queued");
    }

    @Test
    void runnerFollowsQueueOrderAndSkipsCancelledJobs() {
        SolveJob a = submit("198.51.100.1");
        SolveJob b = submit("198.51.100.2");
        jobs.stop(a);
        assertThat(runnerTasks).hasSize(2);

        // a 몫이던 첫 runner 차례에 b가 실제로 돈다(1초). 남은 차례는 꺼낼 것이 없어 그냥 끝난다
        BlockingQueue<SolveJob.Event> sse = b.subscribe();
        runnerTasks.get(0).run();
        assertThat(b.status()).isEqualTo(SolveJob.Status.DONE);
        assertThat(sse).extracting(SolveJob.Event::name).contains("status", "done");
        runnerTasks.get(1).run();
        assertThat(jobs.queueLength()).isZero();
        assertThat(submit("198.51.100.2").status()).isEqualTo(SolveJob.Status.QUEUED);
    }
}
