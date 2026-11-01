package com.example.starter_project_2025.system.exam.code;

import com.example.starter_project_2025.system.exam.code.CodeRunner.RunOutcome;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Chay code cua thi sinh voi cac test case cua mot cau hoi lap trinh. */
@Service
public class CodeJudgeService {

    public static final int MAX_CODE_LENGTH = 20000;
    private static final int MAX_OUTPUT_SHOWN = 2000;

    private final CodeRunner runner;
    private final ExecutorService pool = Executors.newFixedThreadPool(4, r -> {
        Thread t = new Thread(r, "code-judge");
        t.setDaemon(true);
        return t;
    });

    public CodeJudgeService(CodeRunner runner) {
        this.runner = runner;
    }

    /** Ket qua cua mot test. */
    public record TestResult(boolean passed, boolean infraError, String status, String actual, String error) {
    }

    /** Ket qua cham tat ca test cua mot cau. */
    public record GradeResult(int passed, int total, boolean infraError, String compileError, List<TestResult> tests) {
    }

    /** Cham toan bo test (hien thi + an). */
    public GradeResult grade(CodeSpecDTO spec, String code) {
        List<CodeSpecDTO.TestCase> tests = spec.getTests();
        if (code == null || code.isBlank()) {
            List<TestResult> none = tests.stream()
                    .map(t -> new TestResult(false, false, "NO_CODE", "", "Sinh viên chưa nộp code"))
                    .toList();
            return new GradeResult(0, tests.size(), false, null, none);
        }
        List<CompletableFuture<TestResult>> futures = new ArrayList<>();
        List<TestResult> all = new ArrayList<>();
        for (CodeSpecDTO.TestCase t : tests) {
            futures.add(CompletableFuture.supplyAsync(() -> runOne(spec, code, t.getInputs(), t.getExpected()), pool));
        }
        int passed = 0;
        boolean infra = false;
        String compileError = null;
        for (CompletableFuture<TestResult> f : futures) {
            TestResult r = f.join();
            all.add(r);
            if (r.passed()) passed++;
            if (r.infraError()) infra = true;
            if (compileError == null && "COMPILE_ERROR".equals(r.status())) compileError = r.error();
        }
        return new GradeResult(passed, tests.size(), infra, compileError, all);
    }

    /** Chay tat ca test theo thu tu (cho giao vien xem lai bai). */
    public List<TestResult> runAll(CodeSpecDTO spec, String code) {
        if (code == null || code.isBlank()) {
            return spec.getTests().stream()
                    .map(t -> new TestResult(false, false, "NO_CODE", "", "Sinh viên chưa nộp code"))
                    .toList();
        }
        List<CompletableFuture<TestResult>> futures = new ArrayList<>();
        for (CodeSpecDTO.TestCase t : spec.getTests()) {
            futures.add(CompletableFuture.supplyAsync(() -> runOne(spec, code, t.getInputs(), t.getExpected()), pool));
        }
        return futures.stream().map(CompletableFuture::join).toList();
    }

    /** Chay cac test hien thi (de thi sinh chay thu). */
    public List<TestResult> runVisible(CodeSpecDTO spec, String code) {
        List<CompletableFuture<TestResult>> futures = new ArrayList<>();
        for (CodeSpecDTO.TestCase t : spec.getTests()) {
            if (!t.isVisible()) continue;
            futures.add(CompletableFuture.supplyAsync(() -> runOne(spec, code, t.getInputs(), t.getExpected()), pool));
        }
        return futures.stream().map(CompletableFuture::join).toList();
    }

    /** Chay voi dau vao tuy y; khong co ket qua mong doi nen khong tinh dung/sai. */
    public TestResult runCustom(CodeSpecDTO spec, String code, List<String> inputs) {
        return runOne(spec, code, inputs, null);
    }

    private TestResult runOne(CodeSpecDTO spec, String code, List<String> inputs, String expected) {
        String program = JavaHarness.buildProgram(code, spec);
        RunOutcome out = runner.run(program, JavaHarness.buildStdin(inputs));
        if (out.infraError()) {
            return new TestResult(false, true, "INFRA_ERROR", "", out.statusText());
        }
        if (out.compileError()) {
            return new TestResult(false, false, "COMPILE_ERROR", "", clip(out.compileOutput()));
        }
        if (!out.ranOk()) {
            String detail = out.stderr() == null || out.stderr().isBlank() ? out.statusText() : out.stderr();
            String status = out.statusId() == 5 ? "TIME_LIMIT" : "RUNTIME_ERROR";
            return new TestResult(false, false, status, clip(out.stdout()), clip(detail));
        }
        String actual = out.stdout() == null ? "" : out.stdout().strip();
        if (expected == null) {
            return new TestResult(true, false, "OK", clip(actual), null);
        }
        boolean same = JavaHarness.outputsEqual(spec.getReturnType(), actual, expected);
        return new TestResult(same, false, same ? "OK" : "WRONG_ANSWER", clip(actual), null);
    }

    private static String clip(String s) {
        if (s == null) return "";
        return s.length() <= MAX_OUTPUT_SHOWN ? s : s.substring(0, MAX_OUTPUT_SHOWN) + "…";
    }
}
