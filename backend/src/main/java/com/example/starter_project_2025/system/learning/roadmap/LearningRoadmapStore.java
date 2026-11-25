package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class LearningRoadmapStore {
    private final LearningRoadmapRepository repository;
    private final EntityManager entityManager;

    public record SavedRoadmap(RoadmapGoal goal, Long revision, String planJson, Instant generatedAt, boolean outdated) {
        public SavedRoadmap(RoadmapGoal goal, Long revision, String planJson, Instant generatedAt) {
            this(goal, revision, planJson, generatedAt, false);
        }
    }

    @Transactional(readOnly = true)
    public SavedRoadmap get(Long userId) {
        return repository.findById(userId).map(this::snapshot).orElse(null);
    }

    @Transactional
    public SavedRoadmap saveGoal(Long userId, RoadmapGoal goal, Long expectedRevision) {
        User user = lockUser(userId);
        LearningRoadmap entry = repository.findById(userId).orElse(null);
        requireRevision(entry, expectedRevision);
        if (entry == null) {
            entry = new LearningRoadmap(user, goal);
        } else {
            entry.changeGoal(goal);
        }
        return snapshot(repository.saveAndFlush(entry));
    }

    @Transactional
    public SavedRoadmap savePlan(Long userId, Long expectedRevision, String planJson) {
        lockUser(userId);
        LearningRoadmap entry = repository.findById(userId).orElse(null);
        requireRevision(entry, expectedRevision);
        entry.updatePlan(planJson);
        return snapshot(repository.saveAndFlush(entry));
    }

    private User lockUser(Long userId) {
        // Lock the owning row even before a learner has their first roadmap.
        User user = entityManager.find(User.class, userId, LockModeType.PESSIMISTIC_WRITE);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Learner not found");
        }
        return user;
    }

    private void requireRevision(LearningRoadmap entry, Long expected) {
        Long current = entry == null ? null : entry.getRevision();
        if (!Objects.equals(current, expected)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Learning roadmap changed. Reload and try again.");
        }
    }

    private SavedRoadmap snapshot(LearningRoadmap entry) {
        return new SavedRoadmap(entry.goal(), entry.getRevision(), entry.getPlanJson(), entry.getGeneratedAt(),
                Boolean.TRUE.equals(entry.getPlanOutdated()));
    }
}
