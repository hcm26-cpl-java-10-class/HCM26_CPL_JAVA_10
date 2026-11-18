package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.CodeRunRequest;
import com.example.starter_project_2025.system.exam.dto.CodeRunResponse;
import com.example.starter_project_2025.system.exam.dto.CodeVerifyRequest;
import com.example.starter_project_2025.system.exam.dto.CodeVerifyResponse;
import com.example.starter_project_2025.system.exam.service.AnonymousExamService;
import com.example.starter_project_2025.system.exam.service.CodeVerifyService;
import com.example.starter_project_2025.system.exam.service.ExamCodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamCodeController {

    private final ExamCodeService service;
    private final AnonymousExamService anonymousExamService;
    private final CodeVerifyService verifyService;

    /** Sinh vien co tai khoan chay thu code. */
    @PostMapping("/attempts/{attemptId}/code/run")
    @PreAuthorize("hasAuthority('EXAM_TAKE')")
    public ResponseEntity<CodeRunResponse> run(
            @PathVariable Long attemptId,
            @Valid @RequestBody CodeRunRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.run(attemptId, principal.getUser().getId(), request));
    }

    /** Giao vien doi chieu loi giai mau voi bo test (chua luu cau hoi). */
    @PostMapping("/code/verify")
    @PreAuthorize("hasAnyAuthority('QUESTION_CREATE','QUESTION_UPDATE','EXAM_UPDATE')")
    public ResponseEntity<CodeVerifyResponse> verify(
            @RequestBody CodeVerifyRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(verifyService.verify(principal.getUser().getId(), request));
    }

    /** Xem lop Main he thong tu sinh cho mot khai bao ham (giao vien dang soan cau hoi). */
    @PostMapping("/code/main-preview")
    @PreAuthorize("hasAnyAuthority('QUESTION_CREATE','QUESTION_UPDATE','EXAM_UPDATE')")
    public ResponseEntity<java.util.Map<String, String>> mainPreview(@RequestBody CodeVerifyRequest request) {
        return ResponseEntity.ok(java.util.Map.of("main", verifyService.mainPreview(request == null ? null : request.getSpec())));
    }

    /** Thi an danh. */
    @PostMapping("/anonymous/attempts/{attemptId}/code/run")
    public ResponseEntity<CodeRunResponse> runAnonymous(
            @PathVariable Long attemptId,
            @RequestHeader("X-Anonymous-Session") String sessionToken,
            @Valid @RequestBody CodeRunRequest request
    ) {
        return ResponseEntity.ok(anonymousExamService.runCode(sessionToken, attemptId, request));
    }
}
