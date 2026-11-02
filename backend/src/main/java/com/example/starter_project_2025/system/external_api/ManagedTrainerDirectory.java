package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ManagedTrainerDirectory {
    private final ManagedTeachingTrainerRepository trainers;
    @Transactional(readOnly = true)
    public List<ExternalTrainerDTO> merge(List<ExternalTrainerDTO> shared, String status) {
        var ids = new HashSet<Long>();
        shared.forEach(t -> ids.add(t.getId()));
        var result = new ArrayList<>(shared);
        for (var trainer : trainers.findAll()) {
            if (!ids.add(trainer.getReferenceId())) throw new ExternalApiException("Trainer identity collision. Contact the trainer administrator.");
            var profile = profile(trainer);
            if (status == null || status.isBlank() || status.equalsIgnoreCase(profile.getStatus())) result.add(profile);
        }
        return List.copyOf(result);
    }
    public ExternalTrainerDTO profile(ManagedTeachingTrainer trainer) {
        return new ExternalTrainerDTO(trainer.getReferenceId(), trainer.getName(), trainer.getEmail(), Boolean.TRUE.equals(trainer.getIsActive()) ? "active" : "inactive");
    }
}
