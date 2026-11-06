package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;

/**
 * 점검표의 일정 지문(planSig)은 화면({@code ui/core/engine-adapter.js planSignature}, {@code ui/core/test/run-tests.js}의 같은 상수)과
 * 값이 같아야 한다. 화면은 이 지문으로 점검표가 지금 보이는 일정의 것인지 가려낸다.
 */
class PlanSignatureTest {

    @Test
    void fnv1aMatchesTheBrowser() {
        assertThat(RequirementChecker.fnv1a("hello")).isEqualTo("4f9f2cab");
        assertThat(RequirementChecker.fnv1a("두산")).isEqualTo("1ff5cc87");
    }

    @Test
    void the2025ProjectHasTheSameSignatureAsTheBrowser() throws Exception {
        JSONObject p = RequirementChecker2025Test.project2025();
        assertThat(RequirementChecker.planSignature(p, null)).isEqualTo("64bedacb");
        JSONObject v = RequirementChecker.check(p, null);
        assertThat(v.get("planSig")).isEqualTo("64bedacb");
    }

    @Test
    @SuppressWarnings("unchecked")
    void movingOneSeriesChangesTheSignature() throws Exception {
        JSONObject p = RequirementChecker2025Test.project2025();
        JSONArray plan = Json.array(p.get("plan"));
        ((JSONObject) plan.get(3)).put("calendar", 7L);
        assertThat(RequirementChecker.planSignature(p, null)).isNotEqualTo("64bedacb");
    }
}
