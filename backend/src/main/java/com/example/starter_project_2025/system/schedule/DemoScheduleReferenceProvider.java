package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.external_api.dto.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.List;

/** Explicit opt-in fixtures, never used by the normal integration profile. */
@Component
@Profile("schedule-demo")
public class DemoScheduleReferenceProvider implements ScheduleReferenceProvider {
    @Override
    public ScheduleReferences load() {
        return new ScheduleReferences(
                List.of(ExternalClassDTO.builder().id(1L).code("JAVA-01").name("Java 01")
                        .startDate("2026-01-01").endDate("2027-12-31").status("ACTIVE").build(),
                        ExternalClassDTO.builder().id(2L).code("JAVA-02").name("Java 02")
                        .startDate("2026-01-01").endDate("2027-12-31").status("ACTIVE").build()),
                List.of(ExternalTrainerDTO.builder().id(1L).name("Instructor 1").status("ACTIVE").build(),
                        ExternalTrainerDTO.builder().id(2L).name("Instructor 2").status("ACTIVE").build()),
                List.of(ExternalRoomDTO.builder().id(1L).name("A101").capacity(30).build(),
                        ExternalRoomDTO.builder().id(2L).name("A102").capacity(30).build()),
                List.of(new ScheduleReferences.Assignment(1L, 1L, 1L, 1L, LocalDate.of(2026,1,1), LocalDate.of(2027,12,31), "ACTIVE"),
                        new ScheduleReferences.Assignment(2L, 2L, 1L, 2L, LocalDate.of(2026,1,1), LocalDate.of(2027,12,31), "ACTIVE"),
                        new ScheduleReferences.Assignment(3L, 2L, 1L, 1L, LocalDate.of(2026,1,1), LocalDate.of(2027,12,31), "ACTIVE")),
                List.of(new ScheduleReferences.Holiday(LocalDate.of(2026,11,20), null, "Demo holiday")));
    }
}
