package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.schedule_version.ScheduleVersion;
import com.example.starter_project_2025.system.demo.schedule_version.ScheduleVersionRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Order(12)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ScheduleVersionDataInitializer implements CommandLineRunner {

    ScheduleVersionRepository scheduleVersionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (scheduleVersionRepository.count() > 0) {
            return;
        }

        scheduleVersionRepository.save(
                ScheduleVersion.builder()
                        .classId(1L)
                        .versionNumber(1)
                        .status("ACTIVE")
                        .note("Lịch học chuẩn kỳ 1 - Lớp SE-01")
                        .activatedAt(LocalDateTime.now().minusDays(5))
                        .build()
        );

        scheduleVersionRepository.save(
                ScheduleVersion.builder()
                        .classId(1L)
                        .versionNumber(2)
                        .status("DRAFT")
                        .note("Bản nháp điều chỉnh tuần 3 - Lớp SE-01")
                        .build()
        );

        scheduleVersionRepository.save(
                ScheduleVersion.builder()
                        .classId(2L)
                        .versionNumber(1)
                        .status("ACTIVE")
                        .note("Lịch học mở đầu - Lớp Java-10")
                        .activatedAt(LocalDateTime.now().minusDays(2))
                        .build()
        );

        log.info("Initialized sample ScheduleVersion data.");
    }
}
