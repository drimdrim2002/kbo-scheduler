package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** 정적 파일의 ETag(수정 시각+크기)·Last-Modified·304 판정. 서버는 Cache-Control: no-cache라 브라우저가 매번 이 헤더로 재검증한다. */
class StaticCacheTest {

    @Test
    void etagIsMtimeAndSizeInHex() {
        assertThat(BaseballWebServer.etag(0x18f_0000_0000L, 1234)).isEqualTo("\"18f00000000-4d2\"");
        // 수정 시각이나 크기가 다르면 다른 태그
        assertThat(BaseballWebServer.etag(1L, 10)).isNotEqualTo(BaseballWebServer.etag(2L, 10));
        assertThat(BaseballWebServer.etag(1L, 10)).isNotEqualTo(BaseballWebServer.etag(1L, 11));
    }

    @Test
    void httpDateIsRfc1123Gmt() {
        assertThat(BaseballWebServer.httpDate(0L)).isEqualTo("Thu, 1 Jan 1970 00:00:00 GMT");
    }

    @Test
    void ifNoneMatchWins() {
        String tag = BaseballWebServer.etag(1700000000000L, 100);
        assertThat(BaseballWebServer.notModified(tag, tag, null, 1700000000000L)).isTrue();
        assertThat(BaseballWebServer.notModified("W/" + tag, tag, null, 1700000000000L)).isTrue();
        assertThat(BaseballWebServer.notModified("\"other\", " + tag, tag, null, 1700000000000L)).isTrue();
        assertThat(BaseballWebServer.notModified("*", tag, null, 1700000000000L)).isTrue();
        assertThat(BaseballWebServer.notModified("\"other\"", tag, null, 1700000000000L)).isFalse();
        // Caddy encode가 붙인 압축 꼬리(-gzip·-zstd·-br)는 같은 파일
        String gz = tag.substring(0, tag.length() - 1) + "-gzip\"";
        assertThat(BaseballWebServer.notModified(gz, tag, null, 1700000000000L)).isTrue();
        assertThat(BaseballWebServer.notModified("W/" + tag.substring(0, tag.length() - 1) + "-zstd\"", tag, null, 1700000000000L)).isTrue();
        // 다른 파일(크기만 다름)은 꼬리 규칙에 안 걸린다
        assertThat(BaseballWebServer.notModified(BaseballWebServer.etag(1700000000000L, 1001), BaseballWebServer.etag(1700000000000L, 100), null, 1700000000000L)).isFalse();
        // If-None-Match가 있으면 If-Modified-Since가 맞아도 무시한다
        assertThat(BaseballWebServer.notModified("\"other\"", tag, "Wed, 15 Nov 2023 00:00:00 GMT", 1600000000000L)).isFalse();
    }

    @Test
    void ifModifiedSinceComparesBySecond() {
        // 1700000000000 = Tue, 14 Nov 2023 22:13:20 GMT
        long mtime = 1700000000500L;
        assertThat(BaseballWebServer.notModified(null, "\"x\"", "Tue, 14 Nov 2023 22:13:20 GMT", mtime)).isTrue();
        assertThat(BaseballWebServer.notModified(null, "\"x\"", "Tue, 14 Nov 2023 22:13:19 GMT", mtime)).isFalse();
        assertThat(BaseballWebServer.notModified(null, "\"x\"", "not a date", mtime)).isFalse();
        assertThat(BaseballWebServer.notModified(null, "\"x\"", null, mtime)).isFalse();
    }
}
