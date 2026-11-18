package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.TestResult;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.dto.CodeRunRequest;
import com.example.starter_project_2025.system.exam.dto.CodeRunResponse;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.service.CodeSpecSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Cho thi sinh chay thu code trong luc lam bai (khong tinh diem). */
@Service
@RequiredArgsConstructor
public class ExamCodeService {

    /** Khoang cach toi thieu giua hai lan chay thu cua cung mot luot thi. */
    static final long MIN_INTERVAL_MS = 3000;

    private final ExamAttemptRepository attemptRepository;
    private final CodeJudgeService judgeService;

    private final Map<Long, Long> lastRun = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public CodeRunResponse run(Long attemptId, Long studentId, CodeRunRequest request) {
        ExamAttempt attempt = attemptRepository.findByIdAndStudent_Id(attemptId, studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (attempt.getStatus() != ExamAttemptStatus.IN_PROGRESS) {
            throw new BadRequestException("Bài thi đã kết thúc, không thể chạy thử");
        }
        Instant deadline = attempt.getDeadlineAt() != null ? attempt.getDeadlineAt()
                : attempt.getStartedAt().plusSeconds(attempt.getDurationMinutes() * 60L);
        if (ExamAttemptLifecycle.isExpired(deadline, Instant.now())) {
            throw new BadRequestException("Đã hết giờ làm bài");
        }

        ExamAttemptQuestion question = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.CODING
                        && q.getSourceQuestionId().equals(request.getQuestionId()))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Không phải câu hỏi lập trình của bài làm này"));
        CodeSpecDTO spec = CodeSpecSupport.fromJson(question.getCodeSpec());
        if (spec == null) {
            throw new BadRequestException("Câu hỏi chưa có cấu hình lập trình");
        }

        String code = request.getCode() == null ? "" : request.getCode();
        if (code.isBlank()) {
            throw new BadRequestException("Chưa có code để chạy");
        }
        if (code.length() > CodeJudgeService.MAX_CODE_LENGTH) {
            throw new BadRequestException("Code quá dài (tối đa " + CodeJudgeService.MAX_CODE_LENGTH + " ký tự)");
        }
        List<String> custom = request.getCustomInputs();
        if (custom != null && !custom.isEmpty()) {
            if (custom.size() != spec.getParams().size()) {
                throw new BadRequestException("Cần nhập đủ " + spec.getParams().size() + " giá trị đầu vào");
            }
            for (String v : custom) {
                if (v != null && v.length() > CodeSpecSupport.MAX_VALUE_LENGTH) {
                    throw new BadRequestException("Giá trị đầu vào quá dài");
                }
            }
        } else {
            custom = null;
        }

        throttle(attemptId);

        CodeRunResponse response = new CodeRunResponse();
        int index = 0;
        List<TestResult> results = judgeService.runVisible(spec, code);
        List<CodeSpecDTO.TestCase> visible = spec.getTests().stream().filter(CodeSpecDTO.TestCase::isVisible).toList();
        for (TestResult r : results) {
            CodeRunResponse.TestRun run = toRun(index, r);
            CodeSpecDTO.TestCase t = visible.get(index);
            run.setInputs(t.getInputs());
            run.setExpected(t.getExpected());
            response.getTests().add(run);
            if (r.passed()) response.setPassed(response.getPassed() + 1);
            index++;
        }
        response.setTotal(results.size());
        if (custom != null) {
            TestResult r = judgeService.runCustom(spec, code, custom);
            CodeRunResponse.TestRun run = toRun(0, r);
            run.setInputs(custom);
            response.setCustom(run);
        }
        return response;
    }

    private void throttle(Long attemptId) {
        long now = System.currentTimeMillis();
        Long previous = lastRun.put(attemptId, now);
        if (previous != null && now - previous < MIN_INTERVAL_MS) {
            lastRun.put(attemptId, previous);
            throw new BadRequestException("Vui lòng chờ vài giây giữa các lần chạy thử");
        }
        if (lastRun.size() > 5000) {
            lastRun.entrySet().removeIf(e -> now - e.getValue() > 60_000);
        }
    }

    private static CodeRunResponse.TestRun toRun(int index, TestResult r) {
        CodeRunResponse.TestRun run = new CodeRunResponse.TestRun();
        run.setIndex(index);
        run.setPassed(r.passed());
        run.setStatus(r.status());
        run.setActual(r.actual());
        run.setError(r.error());
        return run;
    }
}
