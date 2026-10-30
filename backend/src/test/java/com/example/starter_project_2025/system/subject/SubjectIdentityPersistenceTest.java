package com.example.starter_project_2025.system.subject;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class SubjectIdentityPersistenceTest {
    @Autowired SubjectRepository repository;
    @Autowired TestEntityManager entityManager;

    private Subject subject(String code, String version) {
        return Subject.builder().code(code).version(version).name("Java lesson")
                .durationHours(40).build();
    }

    @Test
    void normalizesBeforePersistAndFindsCanonicalIdentity() {
        Subject saved = repository.saveAndFlush(subject(" java_core ", " V1.0 "));
        assertEquals("JAVA_CORE", saved.getCode());
        assertEquals("1.0", saved.getVersion());
        assertTrue(repository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), null));
        assertFalse(repository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), saved.getId()));
    }

    @Test
    void recognizesLegacyWhitespaceCaseAndVersionPrefixWithoutRewritingTheRow() {
        entityManager.getEntityManager().createNativeQuery("""
                insert into subjects(code,name,version,duration_hours,is_active,status,created_at,updated_at)
                values (' java_core ','Legacy Java',' V1.0 ',40,true,'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
                """).executeUpdate();
        assertTrue(repository.existsByNormalizedIdentity("JAVA_CORE", List.of("1.0", "v1.0"), null));
    }

    @Test
    void databaseConstraintRejectsEquivalentNewIdentities() {
        repository.saveAndFlush(subject("JAVA_CORE", "1.0"));
        assertThrows(DataIntegrityViolationException.class,
                () -> repository.saveAndFlush(subject(" java_core ", "v1.0")));
    }

    @Test
    void differentVersionsOfTheSameCodeRemainDistinct() {
        repository.saveAndFlush(subject("JAVA_CORE", "1.0"));
        repository.saveAndFlush(subject("java_core", "v2.0"));
        assertTrue(repository.existsByNormalizedIdentity("JAVA_CORE", List.of("2.0", "v2.0"), null));
    }
}
