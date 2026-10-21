package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;

public interface CertificateService
        extends BaseCrudService<Long, CertificateDTO, CertificateFilter> {
    void issueIfCourseCompleted(CourseEnrollment courseEnrollment);
}
