package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.upload.FileStorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class CourseCoverCleanup {
    private final CourseRepository courses;
    private final FileStorageService storage;
    private final TransactionTemplate transaction;
    public CourseCoverCleanup(CourseRepository courses, FileStorageService storage, PlatformTransactionManager manager) {
        this.courses=courses; this.storage=storage; this.transaction=new TransactionTemplate(manager);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        transaction.setReadOnly(true);
    }
    public void afterCommit(String previousUrl) {
        if (previousUrl == null || !TransactionSynchronizationManager.isSynchronizationActive()) return;
        String name=previousUrl.substring(previousUrl.lastIndexOf('/')+1);
        if (!name.matches("course-cover-[a-f0-9]{64}\\.png")) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) return;
                try {
                    transaction.executeWithoutResult(ignored -> storage.removeUnreferencedCourseImage(name,
                        () -> courses.existsByThumbnailUrlEndingWith("/uploads/"+name)));
                } catch (RuntimeException error) {
                    org.slf4j.LoggerFactory.getLogger(CourseCoverCleanup.class).error("Could not clean up a replaced course cover",error);
                }
            }
        });
    }
}
