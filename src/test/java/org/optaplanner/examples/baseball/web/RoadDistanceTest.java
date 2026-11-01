package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;

/** 카카오모빌리티 길찾기 중계: 응답 읽기·캐시·좌표 검사·키를 밖으로 내지 않기 (네트워크 없이 가짜 응답). */
class RoadDistanceTest {

    private static final String OK = "{\"routes\":[{\"result_code\":0,\"result_msg\":\"길 찾기 성공\",\"summary\":{\"distance\":31449,\"duration\":2400}}]}";

    private static JSONObject pt(double lat, double lon) {
        return Json.obj("lat", lat, "lon", lon);
    }

    private static JSONObject body(JSONObject... pairs) {
        List<JSONObject> list = new ArrayList<>(List.of(pairs));
        return Json.obj("pairs", Json.arr(list));
    }

    private static JSONObject pair(double lat1, double lon1, double lat2, double lon2) {
        return Json.obj("from", pt(lat1, lon1), "to", pt(lat2, lon2));
    }

    @Test
    void parsesFirstRouteDistanceInKm() throws Exception {
        assertThat(RoadDistance.parseKm(OK)).isEqualTo(31.4);
        assertThat(RoadDistance.parseKm("{\"routes\":[{\"result_code\":104,\"result_msg\":\"출발지와 도착지가 5 m 이내\"}]}")).isNull();
        assertThat(RoadDistance.parseKm("{\"routes\":[]}")).isNull();
    }

    @Test
    void cacheKeyIgnoresDirection() {
        assertThat(RoadDistance.key(37.5122, 127.0720, 37.2998, 127.0097))
                .isEqualTo(RoadDistance.key(37.2998, 127.0097, 37.5122, 127.0720));
    }

    @Test
    void relaysWithKeyHeaderCachesAndHandlesSameStadium() {
        List<String> urls = new ArrayList<>();
        List<String> auths = new ArrayList<>();
        RoadDistance road = new RoadDistance("test-rest-key", (url, auth) -> {
            urls.add(url);
            auths.add(auth);
            return OK;
        });
        assertThat(road.available()).isTrue();
        JSONObject out = road.handle(body(pair(37.5122, 127.0720, 37.2998, 127.0097),
                pair(37.2998, 127.0097, 37.5122, 127.0720), // 반대 방향 = 캐시
                pair(37.5122, 127.0720, 37.51221, 127.07201)), "198.51.100.1"); // 같은 구장
        JSONArray results = Json.array(out.get("results"));
        assertThat(results).hasSize(3);
        assertThat(Json.object(results.get(2)).get("km")).isEqualTo(0.0);
        // 두 번째는 첫 번째가 끝난 뒤면 캐시, 동시에 돌면 한 번 더 묻는다 — 어느 쪽이든 값은 같다
        assertThat(Json.object(results.get(0)).get("km")).isEqualTo(31.4);
        assertThat(Json.object(results.get(1)).get("km")).isEqualTo(31.4);
        assertThat(urls).isNotEmpty().allMatch((u) -> u.startsWith(RoadDistance.ENDPOINT + "?origin="));
        assertThat(urls.get(0)).contains("127.072000,37.512200").contains("destination=");
        assertThat(auths).allMatch("KakaoAK test-rest-key"::equals);
        assertThat(Json.str(out)).doesNotContain("test-rest-key");
        int calls = urls.size();
        road.handle(body(pair(37.5122, 127.0720, 37.2998, 127.0097)), "198.51.100.1");
        assertThat(urls).hasSize(calls); // 이제는 캐시
    }

    @Test
    void reportsFailureWithoutLeakingKey() {
        RoadDistance road = new RoadDistance("secret-xyz", (url, auth) -> {
            throw new IOException("HTTP 401");
        });
        JSONObject out = road.handle(body(pair(37.5122, 127.0720, 35.1941, 129.0616)), "198.51.100.2");
        JSONObject r = Json.object(Json.array(out.get("results")).get(0));
        assertThat(r.get("km")).isNull();
        assertThat((String) r.get("error")).contains("카카오");
        assertThat(Json.str(out)).doesNotContain("secret-xyz");
    }

    @Test
    void rejectsBadInputAndMissingKey() {
        RoadDistance road = new RoadDistance("k", (url, auth) -> OK);
        assertThatThrownBy(() -> road.handle(body(pair(48.0, 127.0, 37.0, 127.0)), "ip")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> road.handle(Json.obj("pairs", Json.arr(List.of())), "ip")).isInstanceOf(IllegalArgumentException.class);
        List<JSONObject> many = new ArrayList<>();
        for (int i = 0; i <= RoadDistance.MAX_PAIRS; i++) {
            many.add(pair(37.5, 127.0, 35.1, 129.0));
        }
        assertThatThrownBy(() -> road.handle(Json.obj("pairs", Json.arr(many)), "ip")).isInstanceOf(IllegalArgumentException.class);
        RoadDistance off = new RoadDistance("  ", (url, auth) -> OK);
        assertThat(off.available()).isFalse();
        assertThatThrownBy(() -> off.handle(body(pair(37.5, 127.0, 35.1, 129.0)), "ip")).isInstanceOf(IllegalStateException.class);
    }
}
