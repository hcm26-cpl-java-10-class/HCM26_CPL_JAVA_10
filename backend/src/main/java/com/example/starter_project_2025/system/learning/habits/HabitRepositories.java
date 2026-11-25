package com.example.starter_project_2025.system.learning.habits;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

interface HabitGoalRepository extends JpaRepository<HabitGoal, Long> {
    List<HabitGoal> findByOwnerIdOrderByIdDesc(Long owner);
    Optional<HabitGoal> findByIdAndOwnerId(Long id, Long owner);
}

interface HabitTargetRepository extends JpaRepository<HabitGoalTarget, Long> {
    List<HabitGoalTarget> findByOwnerIdOrderByPeriodStartDesc(Long owner);
    Optional<HabitGoalTarget> findByOwnerIdAndPeriodAndPeriodStart(Long owner, GoalPeriod period, LocalDate start);
}

interface HabitSessionRepository extends JpaRepository<HabitSession, Long> {
    Optional<HabitSession> findByActiveOwnerId(Long owner);
    Optional<HabitSession> findByOwnerIdAndRequestKey(Long owner, String requestKey);
    Optional<HabitSession> findByIdAndOwnerIdAndDeletedFalse(Long id, Long owner);
    List<HabitSession> findByOwnerIdAndSourceAndStateAndStudyDateAndDeletedFalse(
        Long owner, StudySource source, StudyState state, LocalDate date);

    @EntityGraph(attributePaths = "intervals")
    List<HabitSession> findByOwnerIdAndStateAndDeletedFalse(Long owner, StudyState state);

    org.springframework.data.domain.Slice<HabitSession> findByOwnerIdAndStateAndDeletedFalseAndStudyDateBetweenOrderByStudyDateDescIdDesc(
        Long owner, StudyState state, LocalDate from, LocalDate to, Pageable page);

    org.springframework.data.domain.Slice<HabitSession> findByOwnerIdAndStateAndSourceAndDeletedFalseAndStudyDateBetweenOrderByStudyDateDescIdDesc(
        Long owner, StudyState state, StudySource source, LocalDate from, LocalDate to, Pageable page);
}

interface HabitObjectiveRepository extends JpaRepository<HabitObjective, Long> {
    List<HabitObjective> findByOwnerIdAndWeekStartOrderByDisplayOrderAscIdAsc(Long owner, LocalDate week);
    List<HabitObjective> findByOwnerIdAndWeekStartBetween(Long owner, LocalDate from, LocalDate to);
    Optional<HabitObjective> findByIdAndOwnerId(Long id, Long owner);
}
