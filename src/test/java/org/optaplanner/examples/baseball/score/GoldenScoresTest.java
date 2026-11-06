package org.optaplanner.examples.baseball.score;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.json.simple.parser.JSONParser;
import org.junit.jupiter.api.Test;
import org.optaplanner.core.api.score.buildin.bendablelong.BendableLongScore;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Calendar;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.domain.Match;

/**
 * 브라우저 채점기 골든 값: {@code ui/core/test/golden/golden-scores.json}. {@code plans.json}의 배정을
 * {@code input_2025.json} 그대로 Java {@link ScoreFormulas#evaluate}로 채점한 값이고,
 * {@code ui/core/test/run-tests.js}(AC-1)가 JS 채점기의 엔진 호환 모드와 맞춰 본다.
 * 다시 만들기: {@code mvn -q test -Dtest=GoldenScoresTest -Dgolden.write=true}
 */
class GoldenScoresTest {

    private static final Path PLANS = Path.of("ui/core/test/golden/plans.json");
    private static final Path GOLDEN = Path.of("ui/core/test/golden/golden-scores.json");
    private static final long DUMMY = 9999L;

    /** {@code calendar[m]}는 JSON 매치 순서 m의 슬롯 번호. -1·9999는 미배정(JS 쪽과 같이). 없으면 initialPlan. */
    private static BendableLongScore score(JSONObject spec) {
        JSONObject input = BaseballApp.readJsonFile(Constants.inputFileName);
        BaseballSolution solution = BaseballApp.makeSolution(input);
        if (Boolean.TRUE.equals(spec.get("initialPlan"))) {
            BaseballApp.setInitialPlan(input, solution);
        } else {
            JSONArray calendar = (JSONArray) spec.get("calendar");
            Map<Long, Calendar> byId = new HashMap<>();
            for (Calendar c : solution.getCalendarList()) {
                byId.put(c.getId(), c);
            }
            for (Match m : solution.getMatchList()) {
                long slot = ((Number) calendar.get(m.getId().intValue())).longValue();
                m.setCalendar(slot < 0 || slot == DUMMY ? null : byId.get(slot));
            }
        }
        return ScoreFormulas.evaluate(solution.getTeamList(), solution.getCalendarList(), solution.getMatchList());
    }

    private static String line(String name, BendableLongScore s) {
        List<String> hard = new ArrayList<>();
        for (int i = 0; i < ScoreFormulas.HARD_LEVELS; i++) {
            hard.add(Long.toString(s.hardScore(i)));
        }
        List<String> soft = new ArrayList<>();
        for (int i = 0; i < ScoreFormulas.SOFT_LEVELS; i++) {
            soft.add(Long.toString(s.softScore(i)));
        }
        return "  {\"name\": \"" + name + "\", \"hard\": [" + String.join(", ", hard) + "], \"soft\": ["
                + String.join(", ", soft) + "], \"score\": \"" + s + "\"}";
    }

    @Test
    void javaScoresMatchTheGoldenFile() throws Exception {
        JSONArray plans = (JSONArray) new JSONParser().parse(Files.readString(PLANS, StandardCharsets.UTF_8));
        List<String> lines = new ArrayList<>();
        for (Object o : plans) {
            JSONObject spec = (JSONObject) o;
            lines.add(line((String) spec.get("name"), score(spec)));
        }
        String expected = "[\n" + String.join(",\n", lines) + "\n]\n";
        if (Boolean.getBoolean("golden.write")) {
            Files.writeString(GOLDEN, expected, StandardCharsets.UTF_8);
        }
        assertThat(Files.readString(GOLDEN, StandardCharsets.UTF_8)).isEqualTo(expected);
    }
}
