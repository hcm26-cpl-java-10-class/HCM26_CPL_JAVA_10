package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;

import java.util.List;

public interface ScoreAppealAdjustmentRepository
        extends BaseCrudRepository<ScoreAppealAdjustment, Long> {

    List<ScoreAppealAdjustment> findByAttempt_IdOrderByCreatedAtAsc(Long attemptId);

    List<ScoreAppealAdjustment> findByAppeal_IdOrderByCreatedAtAsc(Long appealId);
}
