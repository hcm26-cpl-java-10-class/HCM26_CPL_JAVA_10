package com.example.starter_project_2025.system.training;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface ClassEnrollmentRepository extends JpaRepository<ClassEnrollment, Long> {
    List<ClassEnrollment> findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(Long classId);
    Optional<ClassEnrollment> findByTrainingClass_IdAndTraineeId(Long classId, Long traineeId);
    long countByTrainingClass_IdAndIsActiveTrueAndStatus(Long classId, ClassEnrollment.Status status);
    @Query("select count(e) from ClassEnrollment e where e.trainingClass.id = :classId and e.isActive = true and e.status <> com.example.starter_project_2025.system.training.ClassEnrollment.Status.DROPPED_OUT")
    long occupiedSeats(@Param("classId") Long classId);

    @Query("select e from ClassEnrollment e where e.isActive = true and lower(e.personalEmail) in :emails")
    List<ClassEnrollment> findActiveByPersonalEmailsIgnoreCase(@Param("emails") java.util.Collection<String> emails);
}
