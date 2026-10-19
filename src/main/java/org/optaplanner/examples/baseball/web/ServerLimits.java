package org.optaplanner.examples.baseball.web;

/** 공개 서비스 한도. 명령행 인자로 바꾼다. */
record ServerLimits(long defaultSeconds, long maxSeconds, int defaultSeeds, int maxSeeds, int maxJobsPerIp,
        int cacheSize, int maxBodyBytes) {

    static ServerLimits defaults() {
        int cores = Math.max(1, Runtime.getRuntime().availableProcessors());
        int seeds = Math.min(8, cores);
        return new ServerLimits(10, 30, seeds, Math.min(16, cores), 1, 200, 8 * 1024 * 1024);
    }
}
