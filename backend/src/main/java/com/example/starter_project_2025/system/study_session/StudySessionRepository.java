package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StudySessionRepository extends BaseCrudRepository<StudySession, Long> {

    // Conservative date window only: no overlap algorithm or unconfirmed blocking policy.
    // Keep legacy rows and every status/isActive value visible to the future policy layer.
    @org.springframework.data.jpa.repository.Query("""
            select s from StudySession s
            where s.sessionDate >= :dateFrom and s.sessionDate <= :dateTo
            order by s.sessionDate, s.startTime, s.id
            """)
    java.util.List<StudySession> findPotentialScheduleEntries(
            @org.springframework.data.repository.query.Param("dateFrom") java.time.LocalDate dateFrom,
            @org.springframework.data.repository.query.Param("dateTo") java.time.LocalDate dateTo);

	boolean existsBySubjectId(Long subjectId);
    interface StatusCount {
        SessionStatus getStatus();
        long getCount();
    }

    @org.springframework.data.jpa.repository.Query("""
            select s.status as status, count(s) as count from StudySession s
            where (:subjectId is null or s.subjectId = :subjectId)
              and (:dateFrom is null or s.sessionDate >= :dateFrom)
              and (:dateTo is null or s.sessionDate <= :dateTo)
            group by s.status
            """)
    java.util.List<StatusCount> countByStatus(
            @org.springframework.data.repository.query.Param("subjectId") Long subjectId,
            @org.springframework.data.repository.query.Param("dateFrom") java.time.LocalDate dateFrom,
            @org.springframework.data.repository.query.Param("dateTo") java.time.LocalDate dateTo);
}
