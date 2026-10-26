package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface SprintRepository extends BaseCrudRepository<Sprint, Long> {

    Optional<Sprint> findByName(String name);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    List<Sprint> findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(Long projectId);

    List<Sprint> findAllByTeamIdAndIsActiveTrueOrderByStartDateDescIdDesc(Long teamId);
}
