package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import java.util.List;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectTeamOutboxRepository
        extends BaseCrudRepository<ProjectTeamOutboxEvent, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    List<ProjectTeamOutboxEvent> findTop50ByStatusOrderByIdAsc(String status);
}
