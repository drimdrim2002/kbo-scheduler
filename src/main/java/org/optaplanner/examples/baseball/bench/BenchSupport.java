package org.optaplanner.examples.baseball.bench;

import java.util.List;
import org.optaplanner.core.config.localsearch.LocalSearchPhaseConfig;
import org.optaplanner.core.config.phase.PhaseConfig;
import org.optaplanner.core.config.solver.SolverConfig;
import org.optaplanner.core.config.solver.termination.TerminationCompositionStyle;
import org.optaplanner.core.config.solver.termination.TerminationConfig;
import org.optaplanner.examples.baseball.app.BaseballApp;
import org.optaplanner.examples.baseball.domain.BaseballSolution;
import org.optaplanner.examples.baseball.domain.Constants;
import org.optaplanner.examples.baseball.solver.BaseballSolutionInitializer;

/**
 * Builds problems and solver configs for the seed benchmark and the web server. The production XML is read as-is and
 * only the random seed, move thread count, terminations and (optionally) the local-search acceptor and forager are
 * overridden in code.
 *
 * <p>Runs stop on work done, not on time, so the same seed gives the same result on any machine. "Work" is the number of
 * score calculations (candidate moves the solver evaluated). Steps were tried first but a step's cost varies about
 * 13x: once the search is stuck, Late Acceptance rejects most moves and one step can evaluate millions of them.
 * Score calculations cost about the same each (2-3x spread), so they track time far better. OptaPlanner checks the
 * termination after every evaluated move, so a calculation limit stops at the exact same point even in the middle of
 * a long step.
 */
public final class BenchSupport {

    public static final String SOLVER_CONFIG = "org/optaplanner/examples/baseball/solver/baseballSolverConfig.xml";

    /**
     * How many score calculations stand for one requested second, per seed. Set for the public server (Akamai Tokyo,
     * 4 dedicated cores, 4 seeds at once): a 2-minute run there did 738,000 to 962,000 calculations per seed, that is
     * 6,150 to 8,000 per second (2026-11-08). 5,500 is about 10% below the slowest seed so a server run normally ends on
     * this count, and so repeats, before its time limit. The development Mac (M4) is about 4x faster and ends the same run
     * in about a quarter of the chosen time. Changing it changes the result of every run that is asked for in seconds.
     */
    public static final long CALCS_PER_SECOND = 5_500;

    /** Converts the requested "no improvement" seconds into steps (the stop that remains step-based). */
    public static final long STEPS_PER_SECOND = 40;

    /**
     * The "no better score" stop may only end a run after this share of its calculation limit (75 = 75%), so a run asked
     * for 2 minutes does not end after a few dozen seconds just because the search got stuck early. User decision 2026-11-07.
     */
    public static final long MIN_WORK_PERCENT = 75;

    /** Bench tools only: their time limit is a safety cap of this many times the requested seconds (at least 60). */
    public static final long CAP_FACTOR = 3;
    public static final long MIN_CAP_SECONDS = 60;

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

    /** Score calculations a run always does before the "no better score" stop may end it (rounded up). */
    public static long minCalcs(long calcLimit) {
        return (calcLimit * MIN_WORK_PERCENT + 99) / 100;
    }

    public static long capSeconds(long requestedSeconds) {
        return Math.max(MIN_CAP_SECONDS, requestedSeconds * CAP_FACTOR);
    }

    /**
     * Bench config for a run asked for in seconds: it stops after {@code seconds * CALCS_PER_SECOND} score calculations,
     * with a time cap from {@link #capSeconds} as a safety net. Same seed and seconds give the same result on any machine.
     */
    public static SolverConfig workSolverConfig(long seed, long seconds, String moveThreadCount,
            Integer lateAcceptanceSize, Integer acceptedCountLimit) {
        return withWorkLimits(solverConfig(seed, capSeconds(seconds), moveThreadCount, lateAcceptanceSize, acceptedCountLimit),
                Math.max(1, seconds) * CALCS_PER_SECOND, null);
    }

    /**
     * Makes the local-search phase stop on work done instead of time. The phase ends when it has done
     * {@code calcLimit} score calculations, or when it has done at least {@link #minCalcs} of them AND the best score
     * has not improved for {@code unimprovedSteps} steps. The solver-level time limit from {@link #solverConfig} still
     * applies on top (whichever comes first); a run that ends on time is not reproducible.
     *
     * @param unimprovedSteps null or 0 turns the "no better score" stop off
     */
    public static SolverConfig withWorkLimits(SolverConfig config, long calcLimit, Long unimprovedSteps) {
        TerminationConfig termination = new TerminationConfig().withScoreCalculationCountLimit(calcLimit);
        if (unimprovedSteps != null && unimprovedSteps > 0) {
            termination.setTerminationConfigList(List.of(new TerminationConfig()
                    .withTerminationCompositionStyle(TerminationCompositionStyle.AND)
                    .withScoreCalculationCountLimit(minCalcs(calcLimit))
                    .withUnimprovedStepCountLimit(toInt(unimprovedSteps))));
        }
        return withLocalSearchTermination(config, termination);
    }

    /** Step-count limit only (measurement scripts). */
    public static SolverConfig withStepLimits(SolverConfig config, long stepLimit, Long unimprovedSteps) {
        TerminationConfig termination = new TerminationConfig().withStepCountLimit(toInt(stepLimit));
        if (unimprovedSteps != null && unimprovedSteps > 0) {
            termination.setUnimprovedStepCountLimit(toInt(unimprovedSteps));
        }
        return withLocalSearchTermination(config, termination);
    }

    private static SolverConfig withLocalSearchTermination(SolverConfig config, TerminationConfig termination) {
        boolean found = false;
        for (PhaseConfig<?> phase : config.getPhaseConfigList()) {
            if (phase instanceof LocalSearchPhaseConfig localSearch) {
                localSearch.setTerminationConfig(termination);
                found = true;
            }
        }
        if (!found) {
            throw new IllegalStateException("no local search phase in " + SOLVER_CONFIG);
        }
        return config;
    }

    private static int toInt(long v) {
        return (int) Math.min(Integer.MAX_VALUE, v);
    }
}
