package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;

import java.util.Optional;

public interface SessionRepository extends BaseCrudRepository<Session, Long> {
    Optional<Session> findByIdAndIsActiveTrue(Long id);
}
