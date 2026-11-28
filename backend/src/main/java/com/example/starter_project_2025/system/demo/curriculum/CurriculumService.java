package com.example.starter_project_2025.system.demo.curriculum;

public interface CurriculumService {

    CurriculumTreeDTO getTree(Long courseId);

    CurriculumValidationResult validatePublish(Long courseId);

    CurriculumTreeDTO reorder(Long courseId, CurriculumReorderRequest request);
}