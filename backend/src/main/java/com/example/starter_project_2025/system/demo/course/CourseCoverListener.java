package com.example.starter_project_2025.system.demo.course;

import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Covers all persistence paths, including generic imports; JPA-only test slices may omit storage. */
@Component
public class CourseCoverListener {
    @Autowired(required = false)
    private CourseCoverService covers;
    @PrePersist @PreUpdate
    public void saveCover(Course course) { if (covers != null) covers.ensureCover(course); }
}
