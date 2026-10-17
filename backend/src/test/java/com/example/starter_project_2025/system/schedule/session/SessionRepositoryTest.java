package com.example.starter_project_2025.system.schedule.session;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest(showSql = false)
@ContextConfiguration(classes = SessionRepositoryTest.JpaConfig.class)
class SessionRepositoryTest {

    @TestConfiguration
    @EntityScan(basePackageClasses = Session.class)
    @EnableJpaRepositories(basePackageClasses = SessionRepository.class)
    static class JpaConfig {}

    @Autowired private SessionRepository repository;
    @Autowired private TestEntityManager entityManager;

    @Test
    void readsPersistedSessionAndExcludesSoftDeletedSession() {
        Session session = Session.builder().calendarVersionId(20L).topicId(12L).trainerId(7L)
                .title("MVC practice").startTime(LocalDateTime.of(2026, 10, 15, 8, 0))
                .endTime(LocalDateTime.of(2026, 10, 15, 10, 0)).build();
        entityManager.persistAndFlush(session);
        Long id = session.getId();
        entityManager.clear();

        Session stored = repository.findByIdAndIsActiveTrue(id).orElseThrow();
        assertThat(stored.getTitle()).isEqualTo("MVC practice");
        assertThat(stored.getStatus()).isEqualTo(SessionStatus.SCHEDULED);
        assertThat(stored.getCreatedAt()).isNotNull();
        stored.setIsActive(false);
        entityManager.flush();
        entityManager.clear();

        assertThat(repository.findByIdAndIsActiveTrue(id)).isEmpty();
        assertThat(repository.findById(id)).isPresent();
        assertThat(repository.findByIdAndIsActiveTrue(Long.MAX_VALUE)).isEmpty();
    }
}
