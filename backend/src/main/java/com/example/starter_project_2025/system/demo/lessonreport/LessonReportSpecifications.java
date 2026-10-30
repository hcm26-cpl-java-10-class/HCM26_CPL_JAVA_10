package com.example.starter_project_2025.system.demo.lessonreport;

import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

final class LessonReportSpecifications {

    private LessonReportSpecifications() {
    }

    static Specification<LessonReport> inbox(Long instructorId, LessonReportStatus status) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            Path<Object> course = root.get("lesson").get("section").get("course");
            if (instructorId != null) {
                predicates.add(cb.equal(course.get("instructorUser").get("id"), instructorId));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
