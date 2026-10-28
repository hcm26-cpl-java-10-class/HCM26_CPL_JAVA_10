package com.example.starter_project_2025.system.subject;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Reconcile legacy rows once per startup; new writes synchronize both fields in the service. */
@Component
@Order(31)
@RequiredArgsConstructor
public class SubjectStatusInitializer implements CommandLineRunner {
    private final EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) {
        entityManager.createQuery("update Subject s set s.isActive = false where s.status = :draft")
                .setParameter("draft", SubjectStatus.DRAFT).executeUpdate();
        entityManager.createQuery("update Subject s set s.status = :active where s.isActive = true")
                .setParameter("active", SubjectStatus.ACTIVE).executeUpdate();
        entityManager.createQuery("update Subject s set s.status = :inactive where s.isActive = false")
                .setParameter("inactive", SubjectStatus.INACTIVE).executeUpdate();
    }
}
