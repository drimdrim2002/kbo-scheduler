package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** 연도별 거리 저장: 방향별 값 유지·덮어쓰기·입력 검사, 관리자 비밀번호. */
class DistanceStoreTest {

    @TempDir
    Path tmp;

    private static JSONObject d(String from, String to, double km) {
        return Json.obj("from", from, "to", to, "distance", km, "estimated", false, "source", "ROAD");
    }

    private static JSONObject body(JSONObject... distances) {
        return Json.obj("distances", Json.arr(List.of(distances)),
                "teams", Json.arr(List.of(Json.obj("name", "LG", "latitude", 37.5, "longitude", 127.0))));
    }

    @Test
    void savesEachYearAndKeepsDirections() throws IOException {
        DistanceStore store = new DistanceStore(tmp.resolve("distances"));
        assertThat(store.list()).isEmpty();
        assertThat(store.load(2027)).isEmpty();

        JSONObject summary = store.save(2027, body(d("LG", "KT", 32.9), d("KT", "LG", 32.7)));
        assertThat(summary.get("count")).isEqualTo(2L);
        store.save(2025, body(d("LG", "KT", 40.0)));

        JSONArray list = store.list();
        assertThat(list).hasSize(2);
        assertThat(Json.object(list.get(0)).get("year")).isEqualTo(2025L);

        JSONArray saved = Json.array(store.load(2027).orElseThrow().get("distances"));
        assertThat(Json.object(saved.get(0)).get("distance")).isEqualTo(32.9);
        assertThat(Json.object(saved.get(1)).get("distance")).isEqualTo(32.7);
        assertThat(Json.object(saved.get(1)).get("source")).isEqualTo("ROAD");
        assertThat(Json.array(store.load(2027).orElseThrow().get("teams"))).hasSize(1);
    }

    @Test
    void savingAgainReplacesThatYearOnly() throws IOException {
        DistanceStore store = new DistanceStore(tmp);
        store.save(2027, body(d("LG", "KT", 32.9), d("KT", "LG", 32.7)));
        store.save(2025, body(d("LG", "KT", 40.0)));
        store.save(2027, body(d("LG", "KT", 50.0)));
        assertThat(Json.array(store.load(2027).orElseThrow().get("distances"))).hasSize(1);
        assertThat(Json.array(store.load(2025).orElseThrow().get("distances"))).hasSize(1);
        assertThat(Files.exists(tmp.resolve("2027.json.tmp"))).isFalse();
    }

    @Test
    void rejectsBadValues() {
        DistanceStore store = new DistanceStore(tmp);
        assertThatThrownBy(() -> store.save(2027, new JSONObject())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> store.save(2027, body(d("LG", "KT", -1)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> store.save(2027, body(d("LG", "KT", 2001)))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> store.save(2027, body(d("", "KT", 10)))).isInstanceOf(IllegalArgumentException.class);
        assertThat(store.load(2027)).isEmpty();
    }

    @Test
    void yearInAddressCannotEscapeTheFolder() {
        assertThat(DistanceStore.parseYear("2027")).isEqualTo(2027);
        for (String bad : List.of("../x", "20271", "1999", "2101", "abcd", "")) {
            assertThatThrownBy(() -> DistanceStore.parseYear(bad)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    private static int status(Runnable r) {
        try {
            r.run();
            return 200;
        } catch (JobManager.RejectedException e) {
            return e.httpStatus;
        }
    }

    @Test
    void passwordChecksAndLocksOutAfterRepeatedFailures() {
        AdminPassword admin = new AdminPassword("right-one");
        assertThat(admin.configured()).isTrue();
        assertThat(status(() -> admin.check("right-one", "a"))).isEqualTo(200);
        assertThat(status(() -> admin.check(null, "a"))).isEqualTo(403);
        for (int i = 1; i < AdminPassword.MAX_FAILS; i++) {
            assertThat(status(() -> admin.check("wrong", "a"))).isEqualTo(403);
        }
        assertThat(status(() -> admin.check("right-one", "a"))).isEqualTo(429); // 맞는 값이어도 막힌 동안은 거절
        assertThat(status(() -> admin.check("right-one", "b"))).isEqualTo(200); // 다른 주소는 그대로
    }

    @Test
    void withoutPasswordSavingIsOff() {
        AdminPassword off = new AdminPassword("  ");
        assertThat(off.configured()).isFalse();
        assertThat(status(() -> off.check("", "a"))).isEqualTo(503);
        assertThat(status(() -> off.check("  ", "a"))).isEqualTo(503);
    }
}
