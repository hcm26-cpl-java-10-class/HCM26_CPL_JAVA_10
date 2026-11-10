package com.example.starter_project_2025.system.exam.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/** Quet dinh ky cac cau coding dang cho cham. Chay tren luong rieng de khong chan cac job khac. */
@Slf4j
@Component
@RequiredArgsConstructor
public class CodingGradingJob {

    private static final int BATCH_SIZE = 5;

    private final CodingGradingService gradingService;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "coding-grader");
        t.setDaemon(true);
        return t;
    });

    @Scheduled(
            fixedDelayString = "${exam.coding.grading-poll-ms:10000}",
            initialDelayString = "${exam.coding.grading-poll-ms:10000}"
    )
    public void run() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        worker.submit(() -> {
            try {
                int handled = gradingService.gradeDue(BATCH_SIZE);
                if (handled > 0) {
                    log.info("Da xu ly {} cau coding cho cham", handled);
                }
            } catch (RuntimeException e) {
                log.warn("Job cham coding loi", e);
            } finally {
                running.set(false);
            }
        });
    }
}
