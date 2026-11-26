package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.session.Session;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface TrainerRepository extends BaseCrudRepository<Trainer, Long> {

    boolean existsByTrainerCodeIgnoreCaseAndIdNot(String code, Long id);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Trainer t where t.id = :id and t.isActive = true")
    Optional<Trainer> findForUpdate(@Param("id") Long id);

    Optional<Trainer> findByIdAndIsActiveTrue(Long id);

    @Query("select (count(a) > 0) from TeachingAssignment a where a.trainerId = :id and a.trainerSource = 'INTERNAL'")
    boolean hasInternalAssignments(@Param("id") Long id);

    @Query("select (count(c) > 0) from TrainingOperationClass c where c.masterTrainerId = :id")
    boolean hasClasses(@Param("id") Long id);

    @Query("""
            select new com.example.starter_project_2025.system.trainer.TrainerDTO$TeachingHistoryItem(
                c.code, c.name, s.code, s.name, s.version, cast(a.role as string), a.effectiveFrom, a.effectiveTo
            )
            from TeachingAssignment a
            join a.programSubject ps
            join ps.subject s
            left join TrainingOperationClass c on c.id = a.classId
            where a.trainerId = :id
              and a.trainerSource = 'INTERNAL'
              and a.isActive = true
            order by a.effectiveFrom desc, a.id desc
            """)
    List<TrainerDTO.TeachingHistoryItem> findTeachingHistory(@Param("id") Long id);

    @Query("""
            select s.trainerId, count(s)
            from Session s
            where s.trainerId in :trainerIds
              and s.isActive = true
              and s.status = :status
              and s.startTime >= :weekStart
              and s.startTime < :weekEnd
            group by s.trainerId
            """)
    List<Object[]> countScheduledSessionsInRange(
            @Param("trainerIds") Collection<Long> trainerIds,
            @Param("status") Session.SessionStatus status,
            @Param("weekStart") LocalDateTime weekStart,
            @Param("weekEnd") LocalDateTime weekEnd
    );

    @Query("""
            select a.trainerId, count(distinct a.classId)
            from TeachingAssignment a
            where a.trainerId in :trainerIds
              and a.trainerSource = 'INTERNAL'
              and a.isActive = true
            group by a.trainerId
            """)
    List<Object[]> countActiveClasses(@Param("trainerIds") Collection<Long> trainerIds);
}
