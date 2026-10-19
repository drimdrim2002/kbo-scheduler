package org.optaplanner.examples.baseball.bench;

import org.optaplanner.core.config.localsearch.LocalSearchPhaseConfig;
import org.optaplanner.core.config.phase.PhaseConfig;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.core.config.solver.termination.TerminationConfig;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;

/**
 * Builds problems and solver configs for the seed benchmark. The production XML is read as-is and only
 * the random seed, move thread count, solver-level termination and (optionally) the local-search acceptor
 * and forager are overridden in code, so the XML defaults stay untouched.
 */
public final class BenchSupport {

    public static final String SOLVER_CONFIG = "org/optaplanner/examples/baseball/solver/baseballSolverConfig.xml";

    private BenchSupport() {
    }

    /** Reads the input JSON and builds an uninitialized problem (all calendars null). */
    public static BaseballSolution loadProblem(String inputPath) {
        return BaseballApp.makeSolution(BaseballApp.readJsonFile(inputPath));
    }

    /** Reads the default input and runs the Hard 0/0 initializer with the given seed. */
    public static BaseballSolution initializedProblem(long seed) {
        return initializedProblem(Constants.inputFileName, seed);
    }

    public static BaseballSolution initializedProblem(String inputPath, long seed) {
        BaseballSolution problem = loadProblem(inputPath);
        BaseballSolutionInitializer.initialize(problem, seed);
        return problem;
    }

    /**
     * @param moveThreadCount "NONE", "AUTO" or a number
     * @param lateAcceptanceSize null keeps the XML value
     * @param acceptedCountLimit null keeps the XML value
     */
    public static SolverConfig solverConfig(long seed, long secondsSpentLimit, String moveThreadCount,
            Integer lateAcceptanceSize, Integer acceptedCountLimit) {
        SolverConfig config = SolverConfig.createFromXmlResource(SOLVER_CONFIG);
        config.withRandomSeed(seed)
                .withMoveThreadCount(moveThreadCount)
                .withTerminationConfig(new TerminationConfig().withSecondsSpentLimit(secondsSpentLimit));
        if (lateAcceptanceSize != null || acceptedCountLimit != null) {
            for (PhaseConfig<?> phase : config.getPhaseConfigList()) {
                if (phase instanceof LocalSearchPhaseConfig localSearch) {
                    if (lateAcceptanceSize != null) {
                        localSearch.getAcceptorConfig().setLateAcceptanceSize(lateAcceptanceSize);
                    }
                    if (acceptedCountLimit != null) {
                        localSearch.getForagerConfig().setAcceptedCountLimit(acceptedCountLimit);
                    }
                }
            }
        }
        return config;
    }
}
