package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;

import java.util.List;
import java.util.UUID;

public interface CertificateService
        extends BaseCrudService<Long, CertificateDTO, CertificateFilter> {
    void issueIfCourseCompleted(CourseEnrollment courseEnrollment);
    CertificateVerificationDTO verify(UUID verificationToken);
    List<CertificateDTO> getMyCertificates(Long userId);
}
