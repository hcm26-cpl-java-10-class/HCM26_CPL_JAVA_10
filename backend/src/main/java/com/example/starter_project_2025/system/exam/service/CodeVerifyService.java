package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.TestResult;
import com.example.starter_project_2025.system.exam.dto.CodeVerifyRequest;
import com.example.starter_project_2025.system.exam.dto.CodeVerifyResponse;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import com.example.starter_project_2025.system.question.service.CodeSpecSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Cho giao vien chay thu loi giai mau tren toan bo test (ke ca test an) khi soan cau hoi lap trinh. */
@Service
@RequiredArgsConstructor
public class CodeVerifyService {

    /** Moi lan chay goi may cham cho ca bo test nen gian cach toi thieu giua hai lan cua mot nguoi dung. */
    static final long MIN_INTERVAL_MS = 5000;
    static final int MAX_TESTS = 20;

    private final CodeJudgeService judgeService;
    private final Map<Long, Long> lastRun = new ConcurrentHashMap<>();

    public CodeVerifyResponse verify(Long userId, CodeVerifyRequest request) {
        CodeSpecDTO spec = request == null ? null : request.getSpec();
        List<String> problems = CodeSpecSupport.validateSignature(spec);
        if (!problems.isEmpty()) {
            throw new BadRequestException(problems.get(0));
        }
        if (spec.getTests() == null || spec.getTests().isEmpty() || spec.getTests().size() > MAX_TESTS) {
            throw new BadRequestException("Cần có từ 1 đến " + MAX_TESTS + " test case để chạy thử");
        }
        String code = request.getCode() == null ? "" : request.getCode();
        if (code.isBlank()) {
            throw new BadRequestException("Chưa nhập lời giải mẫu");
        }
        if (code.length() > CodeJudgeService.MAX_CODE_LENGTH) {
            throw new BadRequestException("Code quá dài (tối đa " + CodeJudgeService.MAX_CODE_LENGTH + " ký tự)");
        }
        throttle(userId);

        List<TestResult> results = judgeService.verify(spec, code);
        CodeVerifyResponse response = new CodeVerifyResponse();
        for (int i = 0; i < results.size(); i++) {
            TestResult r = results.get(i);
            CodeVerifyResponse.Item item = new CodeVerifyResponse.Item();
            item.setIndex(i);
            item.setVisible(spec.getTests().get(i).isVisible());
            item.setStatus(r.status());
            item.setActual(r.actual());
            item.setError(r.error());
            item.setMatches(r.passed());
            if (r.passed()) response.setMatched(response.getMatched() + 1);
            if (r.infraError()) response.setInfraError(true);
            if (response.getCompileError() == null && "COMPILE_ERROR".equals(r.status())) {
                response.setCompileError(r.error());
            }
            response.getTests().add(item);
        }
        response.setTotal(results.size());
        return response;
    }

    /** Lop Main he thong tu sinh cho khai bao ham (khong chay gi, khong goi may cham). */
    public String mainPreview(CodeSpecDTO spec) {
        if (spec == null) {
            throw new BadRequestException("Thiếu khai báo hàm");
        }
        spec.setCustomMain(false);
        List<String> problems = CodeSpecSupport.validateSignature(spec);
        if (!problems.isEmpty()) {
            throw new BadRequestException(problems.get(0));
        }
        return com.example.starter_project_2025.system.exam.code.JavaHarness.generatedMain(spec);
    }

    private void throttle(Long userId) {
        long now = System.currentTimeMillis();
        Long previous = lastRun.put(userId, now);
        if (previous != null && now - previous < MIN_INTERVAL_MS) {
            lastRun.put(userId, previous);
            throw new BadRequestException("Vui lòng chờ vài giây giữa các lần chạy thử lời giải mẫu");
        }
        if (lastRun.size() > 2000) {
            lastRun.entrySet().removeIf(e -> now - e.getValue() > 60_000);
        }
    }
}
