package com.example.starter_project_2025.system.subject;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SubjectUsageService {
    private final EntityManager entityManager;

    public record Usage(long programSubjects, long teachingAssignments, long sessions, long studySessions) {
        public boolean isReferenced() {
            return programSubjects + teachingAssignments + sessions + studySessions > 0;
        }
    }

    public Usage getUsage(Long id) {
        return new Usage(
                count("select count(p) from ProgramSubject p where p.subject.id = :id", id),
                count("select count(a) from TeachingAssignment a where a.programSubject.subject.id = :id", id),
                count("select count(s) from Session s where s.topicId = :id", id),
                count("select count(s) from StudySession s where s.subjectId = :id", id));
    }

    private long count(String query, Long id) {
        return entityManager.createQuery(query, Long.class).setParameter("id", id).getSingleResult();
    }
}
