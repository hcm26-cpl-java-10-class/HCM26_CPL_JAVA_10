package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.schedule_version.ScheduleVersion;
import com.example.starter_project_2025.system.demo.schedule_version.ScheduleVersionRepository;
import com.example.starter_project_2025.system.schedule_version.ScheduleVersionStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
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

    @Qualifier("legacyScheduleVersionRepository")
    ScheduleVersionRepository legacyScheduleVersionRepository;

    com.example.starter_project_2025.system.schedule_version.ScheduleVersionRepository scheduleVersionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (legacyScheduleVersionRepository.count() == 0) {
            legacyScheduleVersionRepository.save(
                    ScheduleVersion.builder()
                            .classId(1L)
                            .versionNumber(1)
                            .status("ACTIVE")
                            .note("Lịch học chuẩn kỳ 1 - Lớp SE-01")
                            .activatedAt(LocalDateTime.now().minusDays(5))
                            .build()
            );

            legacyScheduleVersionRepository.save(
                    ScheduleVersion.builder()
                            .classId(1L)
                            .versionNumber(2)
                            .status("DRAFT")
                            .note("Bản nháp điều chỉnh tuần 3 - Lớp SE-01")
                            .build()
            );

            legacyScheduleVersionRepository.save(
                    ScheduleVersion.builder()
                            .classId(2L)
                            .versionNumber(1)
                            .status("ACTIVE")
                            .note("Lịch học mở đầu - Lớp Java-10")
                            .activatedAt(LocalDateTime.now().minusDays(2))
                            .build()
            );
        }

        if (scheduleVersionRepository.count() == 0) {
            // Lớp CLASS-01: có 1 bản ARCHIVED (v1), 1 bản ACTIVE (v2), và 1 bản DRAFT (v3)
            scheduleVersionRepository.save(
                    com.example.starter_project_2025.system.schedule_version.ScheduleVersion.builder()
                            .classId("CLASS-01")
                            .versionNumber(1)
                            .status(ScheduleVersionStatus.ARCHIVED)
                            .note("Lịch ban đầu khai giảng")
                            .activatedAt(LocalDateTime.now().minusDays(30))
                            .build()
            );

            scheduleVersionRepository.save(
                    com.example.starter_project_2025.system.schedule_version.ScheduleVersion.builder()
                            .classId("CLASS-01")
                            .versionNumber(2)
                            .status(ScheduleVersionStatus.ACTIVE)
                            .note("Lịch chính thức đang áp dụng")
                            .activatedAt(LocalDateTime.now().minusDays(10))
                            .build()
            );

            scheduleVersionRepository.save(
                    com.example.starter_project_2025.system.schedule_version.ScheduleVersion.builder()
                            .classId("CLASS-01")
                            .versionNumber(3)
                            .status(ScheduleVersionStatus.DRAFT)
                            .note("Bản nháp cập nhật phòng máy")
                            .clonedFromVersionId("2")
                            .build()
            );

            // Lớp CLASS-02: có 1 bản ACTIVE (v1)
            scheduleVersionRepository.save(
                    com.example.starter_project_2025.system.schedule_version.ScheduleVersion.builder()
                            .classId("CLASS-02")
                            .versionNumber(1)
                            .status(ScheduleVersionStatus.ACTIVE)
                            .note("Lịch chính thức kỳ 1")
                            .activatedAt(LocalDateTime.now().minusDays(5))
                            .build()
            );

            // Lớp CLASS-03: chưa có bản ACTIVE, chỉ có DRAFT (v1)
            scheduleVersionRepository.save(
                    com.example.starter_project_2025.system.schedule_version.ScheduleVersion.builder()
                            .classId("CLASS-03")
                            .versionNumber(1)
                            .status(ScheduleVersionStatus.DRAFT)
                            .note("Bản nháp khởi tạo ban đầu")
                            .build()
            );
        }

        log.info("Initialized sample ScheduleVersion data for demo and real modules.");
    }
}
