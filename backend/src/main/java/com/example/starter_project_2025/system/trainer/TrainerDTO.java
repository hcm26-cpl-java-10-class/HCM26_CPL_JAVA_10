package com.example.starter_project_2025.system.trainer;

import java.util.List;

public record TrainerDTO(Long id, String trainerCode, String fullName, String email, String specialization,
                         TrainerStatus status, List<Topic> teachingTopics, String source) {
    public record Topic(Long id, String code, String name, String version, boolean active) {}
}
