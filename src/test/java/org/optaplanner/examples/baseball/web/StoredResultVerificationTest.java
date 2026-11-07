package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.Constants;

/**
 * 요구 사항 점검이 생기기 전에 저장된 결과({@code data/results/default.json})는 파일을 다시 만들지 않고 열 때 점검한다:
 * 서버의 2025 프로젝트에 저장된 조건(어린이날 홈 구단)을 입혀서 센다. 기본 결과는 어긴 항목이 없어야 한다.
 */
class StoredResultVerificationTest {

    @Test
    void theDefaultResultIsVerifiedWhenOpened() throws Exception {
        JSONObject stored = Json.object(Json.parse(Files.readString(Path.of("data/results/default.json"), StandardCharsets.UTF_8)));
        Path input = Path.of(Constants.inputFileName);
        JSONObject project = Showcase.loadVerifyProblem(input, BaseballApp.readJsonFile(input.toString()));
        assertThat(project.get("settings")).as("project_2025.json next to the engine input").isNotNull();
        JSONObject problem = Showcase.problemWithKnobs(project, Json.object(stored.get("knobs")));
        JSONArray plan = Json.array(stored.get("plan"));
        assertThat(Showcase.planFits(problem, plan)).isTrue();
        // 저장된 조건의 어린이날 홈 구단이 이벤트로 들어간다
        boolean children = false;
        for (Object o : Json.array(problem.get("events"))) {
            JSONObject ev = (JSONObject) o;
            if ("CHILDREN".equals(ev.get("type"))) {
                children = true;
                assertThat(Json.canonical(ev.get("teams"))).isEqualTo(Json.canonical(Json.object(stored.get("knobs")).get("childrenDayHomeTeams")));
            }
        }
        assertThat(children).isTrue();
        JSONObject v = JobManager.verify(problem, plan);
        System.out.println("default result: " + v.get("passed") + " passed, " + v.get("failed") + " failed (" + v.get("failedTitles") + ")");
        assertThat(v.get("error")).isNull();
        assertThat(RequirementChecker.failedIds(v)).isEmpty();
    }

    @Test
    void aPlanFromAnotherCalendarIsNotForced() throws Exception {
        JSONObject project = RequirementChecker2025Test.project2025();
        JSONArray plan = Json.array(project.get("plan"));
        JSONArray shorter = new JSONArray();
        for (int i = 0; i < plan.size() - 1; i++) {
            shorter.add(plan.get(i));
        }
        assertThat(Showcase.planFits(project, shorter)).isFalse();
        assertThat(Showcase.planFits(project, plan)).isTrue();
    }
}
