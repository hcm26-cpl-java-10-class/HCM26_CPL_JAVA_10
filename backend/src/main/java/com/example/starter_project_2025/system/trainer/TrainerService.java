package com.example.starter_project_2025.system.trainer;

import org.springframework.data.domain.Page;
import java.util.List;
import java.util.Set;

public interface TrainerService {
    default Page<TrainerDTO> list(String search, String status, int page, int size) {
        return list(search, status, null, page, size);
    }
    Page<TrainerDTO> list(String search, String status, Long topicId, int page, int size);
    TrainerDTO get(Long id);
    TrainerDTO create(CreateTrainerRequest request);
    TrainerDTO update(Long id, UpdateTrainerRequest request);
    TrainerDTO changeStatus(Long id, TrainerStatus status);
    int bulkChangeStatus(Set<Long> ids, TrainerStatus status);
    void delete(Long id);
    List<TrainerDTO.Topic> topics();
}
