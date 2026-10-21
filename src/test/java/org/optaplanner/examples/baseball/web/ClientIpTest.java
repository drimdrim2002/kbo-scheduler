package org.optaplanner.examples.baseball.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;

/** IP당 동시 1작업 제한의 방문자 주소: 같은 기계의 Caddy가 넣은 X-Real-IP만 믿는다. */
class ClientIpTest {

    @Test
    void trustsRealIpOnlyFromLoopbackProxy() throws Exception {
        InetAddress loopback4 = InetAddress.getByName("127.0.0.1");
        InetAddress loopback6 = InetAddress.getByName("::1");
        InetAddress outside = InetAddress.getByName("203.0.113.7");

        // Caddy(루프백) → 서버: Caddy가 정한 방문자 주소
        assertThat(BaseballWebServer.clientIp(loopback4, "198.51.100.20")).isEqualTo("198.51.100.20");
        assertThat(BaseballWebServer.clientIp(loopback6, " 2001:db8::5 ")).isEqualTo("2001:db8::5");
        // 헤더 없이 로컬에서 직접(개발 PC 브라우저·curl)
        assertThat(BaseballWebServer.clientIp(loopback4, null)).isEqualTo("127.0.0.1");
        assertThat(BaseballWebServer.clientIp(loopback4, "  ")).isEqualTo("127.0.0.1");
        // 바깥에서 서버로 바로 온 요청이 꾸민 헤더는 무시한다(같은 Wi-Fi 휴대폰 등)
        assertThat(BaseballWebServer.clientIp(outside, "198.51.100.20")).isEqualTo("203.0.113.7");
    }
}
