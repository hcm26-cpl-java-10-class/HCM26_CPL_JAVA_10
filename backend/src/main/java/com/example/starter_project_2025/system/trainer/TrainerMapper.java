package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.system.subject.Subject;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

@Component
public class TrainerMapper {

    public TrainerDTO toDTO(Trainer trainer) {
        return toDTO(trainer, List.of());
    }

    public TrainerDTO toDTO(Trainer trainer, List<TrainerDTO.TeachingHistoryItem> teachingHistory) {
        List<TrainerDTO.Topic> topics = trainer.getTeachingTopics().stream()
                .sorted(Comparator.comparing(Subject::getId))
                .map(subject -> new TrainerDTO.Topic(
                        subject.getId(),
                        subject.getCode(),
                        subject.getName(),
                        subject.getVersion(),
                        Boolean.TRUE.equals(subject.getIsActive())
                ))
                .toList();

        return new TrainerDTO(
                trainer.getId(),
                trainer.getTrainerCode(),
                trainer.getFullName(),
                trainer.getEmail(),
                trainer.getSpecialization(),
                trainer.getStatus(),
                topics,
                "INTERNAL",
                teachingHistory == null ? List.of() : teachingHistory
        );
    }
}
