package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;

/**
 * (a) KBO가 발표한 2025 1차 일정({@code data/baseball/project_2025.json}의 plan, 2025 설정·이벤트 포함)을 점검기에 넣으면
 * 어긴 항목이 없어야 한다. 통과하지 못하는 항목이 나오면 점검기를 억지로 맞추지 말고 그대로 보고한다(점검기 오류인지,
 * 설정이 실제와 다른지는 사용자가 판단).
 */
class RequirementChecker2025Test {

    static JSONObject project2025() throws Exception {
        return Json.object(Json.parse(Files.readString(Path.of("data/baseball/project_2025.json"), StandardCharsets.UTF_8)));
    }

    @Test
    void theReal2025ScheduleBreaksNoRequirement() throws Exception {
        JSONObject v = RequirementChecker.check(project2025(), null);
        Map<String, String> verdicts = RequirementChecker.verdicts(v);
        System.out.println("2025 real schedule: " + v.get("passed") + " passed, " + v.get("failed") + " failed, " + v.get("info") + " info");
        for (Object g : Json.array(v.get("groups"))) {
            for (Object i : Json.array(((JSONObject) g).get("items"))) {
                JSONObject item = (JSONObject) i;
                System.out.println("  [" + item.get("verdict") + "] " + item.get("title") + " — " + item.get("result") + " (기준: " + item.get("standard") + ")");
            }
        }
        assertThat(verdicts).containsKeys("opening", "children", "pair-games", "home-totals", "rest-weekdays", "blackouts", "season-range",
                "series-length", "length-match", "four-game", "daily-teams", "daily-stadiums", "streak", "repeat-opponent", "unassigned");
        assertThat(RequirementChecker.failedIds(v)).isEmpty();
        assertThat(v.get("ok")).isEqualTo(Boolean.TRUE);
        // 2025 설정에는 홈 경기 수(1차 편성분)가 없어 그 항목만 판정 없이 숫자를 보여 준다
        assertThat(verdicts.get("home-totals")).isEqualTo(RequirementChecker.INFO);
    }
}
