package com.example.starter_project_2025.system.trainer;

import org.springframework.data.domain.Page;
import java.util.List;

public interface TrainerService {
    Page<TrainerDTO> list(String search, String status, int page, int size);
    TrainerDTO get(Long id);
    TrainerDTO create(CreateTrainerRequest request);
    TrainerDTO update(Long id, UpdateTrainerRequest request);
    TrainerDTO changeStatus(Long id, TrainerStatus status);
    void delete(Long id);
    List<TrainerDTO.Topic> topics();
}
