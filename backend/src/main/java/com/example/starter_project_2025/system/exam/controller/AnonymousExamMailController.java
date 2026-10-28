package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.service.AnonymousExamService;
import com.example.starter_project_2025.system.notification.service.EmailService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tien ich cho giao vien: gui lai email ket qua cho thi sinh tu do (guest)
 * khi thieu sinh khong nhan duoc mail, va kiem tra trai trang SMTP.
 */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@Tag(name = "Anonymous Exam Mail", description = "Resend result email for guests / check SMTP")
public class AnonymousExamMailController {

    private final AnonymousExamService anonymousExamService;
    private final EmailService emailService;

    @PostMapping("/attempts/{attemptId}/resend-result-email")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<Map<String, Object>> resendResultEmail(
            @PathVariable Long attemptId,
            @RequestParam(required = false) String email
    ) {
        boolean sent = anonymousExamService.resendResultEmailToGuest(attemptId, email);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("attemptId", attemptId);
        body.put("sent", sent);
        body.put("message", sent
                ? "Result email sent successfully. Check the recipient inbox (and spam folder)."
                : "Could not send result email. Check backend console for SMTP errors "
                + "(MAIL_APP_PASSWORD / Gmail app password).");
        return ResponseEntity.ok(body);
    }

    @PostMapping("/mail/test")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<Map<String, Object>> testMail(@RequestParam String email) {
        boolean sent = emailService.sendTestEmail(email);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("sent", sent);
        body.put("message", sent
                ? "Test email sent. Check the recipient inbox (and spam folder)."
                : "Could not send test email. Check backend console for SMTP errors "
                + "(MAIL_APP_PASSWORD / Gmail app password).");
        return ResponseEntity.ok(body);
    }
}
