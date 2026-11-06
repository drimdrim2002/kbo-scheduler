package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Constants;

/**
 * 올스타 휴식기 이동을 세지 않게 바뀌기 전에 저장된 결과({@code data/results/default.json})는 저장된 일정 그대로
 * 지표만 지금 채점기로 다시 센다. 2025 입력으로 만든 결과가 아니면(지표가 맞지 않으면) 그대로 둔다.
 */
class ShowcaseRecountTest {

    private static JSONObject problem() {
        return BaseballApp.readJsonFile(Constants.inputFileName);
    }

    private static JSONObject storedDefault() throws Exception {
        return Json.object(Json.parse(Files.readString(Path.of("data/results/default.json"), StandardCharsets.UTF_8)));
    }

    private static JSONObject currentMetrics(JSONObject problem, JSONObject result) {
        BaseballSolution solution = ProblemCodec.toSolution(problem);
        ProblemCodec.applyPlan(solution, problem, Json.array(result.get("plan")));
        return Metrics.of(solution);
    }

    @Test
    void anOldDefaultResultIsRecountedFromItsPlan() throws Exception {
        JSONObject problem = problem();
        JSONObject stored = storedDefault();
        JSONObject out = Showcase.recountNow(problem, Showcase.DEFAULT_ID, stored);
        JSONObject fresh = currentMetrics(problem, stored);
        assertThat(Json.canonical(out.get("metrics"))).isEqualTo(Json.canonical(fresh));
        assertThat(Json.asLong(fresh.get("totalKm"), 0)).isLessThan(Json.asLong(Json.object(stored.get("metrics")).get("totalKm"), 0));
        // 일정·다른 값은 그대로
        assertThat(Json.canonical(out.get("plan"))).isEqualTo(Json.canonical(stored.get("plan")));
        assertThat(out.get("createdAt")).isEqualTo(stored.get("createdAt"));
        // 다시 센 결과를 또 세면 그대로
        JSONObject again = Showcase.recountNow(problem, Showcase.DEFAULT_ID, out);
        assertThat(Json.canonical(again)).isEqualTo(Json.canonical(out));
    }

    @Test
    @SuppressWarnings("unchecked")
    void aResultThatDoesNotMatchThe2025InputStaysAsStored() throws Exception {
        JSONObject stored = storedDefault();
        JSONObject metrics = (JSONObject) Json.object(stored.get("metrics")).clone();
        JSONArray teams = new JSONArray();
        for (Object o : Json.array(metrics.get("teams"))) {
            teams.add(((JSONObject) o).clone());
        }
        JSONObject first = (JSONObject) teams.get(0);
        first.put("distanceKm", Json.asDouble(first.get("distanceKm"), 0) + 12.3);
        metrics.put("teams", teams);
        JSONObject other = (JSONObject) stored.clone();
        other.put("metrics", metrics);
        other.put("id", "abcdef012345");
        assertThat(Showcase.recountNow(problem(), "abcdef012345", other)).isSameAs(other);
    }
}
