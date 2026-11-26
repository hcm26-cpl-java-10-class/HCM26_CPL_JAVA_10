package com.example.starter_project_2025.system.demo.certificate;

import java.time.LocalDate;
import java.util.UUID;

public record CertificateVerificationDTO(
        UUID verificationToken,
        String courseName,
        String studentName,
        LocalDate issuedAt,
        boolean valid
) {
}
