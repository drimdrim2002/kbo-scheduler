package org.optaplanner.examples.baseball.reschedule;

import org.optaplanner.core.api.solver.Solver;
import org.optaplanner.core.api.solver.SolverFactory;
import org.optaplanner.core.config.solver.EnvironmentMode;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.core.config.solver.termination.TerminationConfig;

/** 재편성 솔버 설정 읽기와 한 번 돌리기(테스트·벤치·서버 공용). */
public final class RescheduleSolverRunner {

    public static final String SOLVER_CONFIG = "org/optaplanner/examples/baseball/solver/rescheduleSolverConfig.xml";

    private RescheduleSolverRunner() {
    }

    public static SolverConfig config(long seed, long secondsSpentLimit, Long unimprovedSeconds) {
        SolverConfig config = SolverConfig.createFromXmlResource(SOLVER_CONFIG);
        TerminationConfig termination = new TerminationConfig().withSecondsSpentLimit(secondsSpentLimit);
        if (unimprovedSeconds != null && unimprovedSeconds > 0) {
            termination.setUnimprovedSecondsSpentLimit(unimprovedSeconds);
        }
        return config.withRandomSeed(seed).withTerminationConfig(termination);
    }

    /** 첫 배정 + 탐색. */
    public static RescheduleSolution solve(RescheduleSolution problem, long seed, long seconds, Long unimproved,
            EnvironmentMode mode) {
        RescheduleInitializer.initialize(problem, seed);
        SolverConfig config = config(seed, seconds, unimproved);
        if (mode != null) {
            config.setEnvironmentMode(mode);
        }
        Solver<RescheduleSolution> solver = SolverFactory.<RescheduleSolution>create(config).buildSolver();
        return solver.solve(problem);
    }
}
