package com.example.starter_project_2025.system.trainer;

import org.springframework.stereotype.Component;
import java.util.Comparator;

@Component
public class TrainerMapper {
    public TrainerDTO toDTO(Trainer t) {
        return new TrainerDTO(t.getId(), t.getTrainerCode(), t.getFullName(), t.getEmail(), t.getSpecialization(), t.getStatus(),
            t.getTeachingTopics().stream().sorted(Comparator.comparing(s -> s.getId()))
                .map(s -> new TrainerDTO.Topic(s.getId(), s.getCode(), s.getName(), s.getVersion(), Boolean.TRUE.equals(s.getIsActive())))
                .toList(), "INTERNAL");
    }
}
