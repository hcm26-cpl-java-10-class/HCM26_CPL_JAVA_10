package com.example.starter_project_2025.system.calendar.schedule;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.CourseScheduleDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ScheduleConfigDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ScheduleEntryDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.SlotDef;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ClassScheduleGeneratorTest {

    private static final ScheduleConfigDTO DEFAULT_CONFIG = new ScheduleConfigDTO(
            4,
            List.of(
                    new SlotDef(1, "08:00", "12:00"),
                    new SlotDef(2, "13:00", "17:00")
            ),
            List.of(1, 2, 3, 4, 5),
            List.of()
    );

    @Test
    void matchesSection3_3Example_CourseA20hAndCourseB12hSharingWednesday() {
        List<CourseScheduleDTO> courses = List.of(
                new CourseScheduleDTO(10L, "COURSE_A", "Course A", "1.0", 20, 1, 5),
                new CourseScheduleDTO(20L, "COURSE_B", "Course B", "1.0", 12, 2, 3)
        );
        // 2026-10-05 is Monday
        List<ScheduleEntryDTO> entries = ClassScheduleGenerator.generate(
                1L, LocalDate.of(2026, 10, 5), courses, DEFAULT_CONFIG
        );

        assertEquals(8, entries.size());
        // Mon: A(1), A(2)
        assertEquals("2026-10-05", entries.get(0).date());
        assertEquals(1, entries.get(0).slot());
        assertEquals(10L, entries.get(0).courseId());
        assertEquals(1, entries.get(0).order());

        assertEquals("2026-10-05", entries.get(1).date());
        assertEquals(2, entries.get(1).slot());
        assertEquals(10L, entries.get(1).courseId());
        assertEquals(2, entries.get(1).order());

        // Wed: Slot 1 = Course A (order 5), Slot 2 = Course B (order 1)
        assertEquals("2026-10-07", entries.get(4).date());
        assertEquals(1, entries.get(4).slot());
        assertEquals(10L, entries.get(4).courseId());
        assertEquals(5, entries.get(4).order());

        assertEquals("2026-10-07", entries.get(5).date());
        assertEquals(2, entries.get(5).slot());
        assertEquals(20L, entries.get(5).courseId());
        assertEquals(1, entries.get(5).order());

        // Thu: B(2), B(3)
        assertEquals("2026-10-08", entries.get(6).date());
        assertEquals(20L, entries.get(6).courseId());
        assertEquals(2, entries.get(6).order());
        assertEquals("2026-10-08", entries.get(7).date());
        assertEquals(20L, entries.get(7).courseId());
        assertEquals(3, entries.get(7).order());
    }

    @Test
    void roundsUpOddHoursAndSkipsWeekendsAndHolidays() {
        ScheduleConfigDTO withHoliday = new ScheduleConfigDTO(
                4,
                DEFAULT_CONFIG.slots(),
                List.of(1, 2, 3, 4, 5),
                List.of("2026-10-05") // Monday is a holiday
        );
        List<CourseScheduleDTO> courses = List.of(
                new CourseScheduleDTO(10L, "ODD_10H", "Odd 10h Course", "1.0", 10, 1, 3)
        );
        // Start on Saturday 2026-10-03 -> skips Sat/Sun AND Monday holiday -> starts Tuesday 2026-10-06
        List<ScheduleEntryDTO> entries = ClassScheduleGenerator.generate(
                1L, LocalDate.of(2026, 10, 3), courses, withHoliday
        );
        assertEquals(3, entries.size()); // ceil(10 / 4) = 3 slots
        assertEquals("2026-10-06", entries.get(0).date());
        assertEquals(1, entries.get(0).slot());
        assertEquals("2026-10-06", entries.get(1).date());
        assertEquals(2, entries.get(1).slot());
        assertEquals("2026-10-07", entries.get(2).date());
        assertEquals(1, entries.get(2).slot());
    }

    @Test
    void rejectsEmptyProgramInvalidDurationOrMissingStartDate() {
        assertThrows(BadRequestException.class, () ->
                ClassScheduleGenerator.generate(1L, LocalDate.of(2026, 10, 5), List.of(), DEFAULT_CONFIG));

        assertThrows(BadRequestException.class, () ->
                ClassScheduleGenerator.generate(1L, null,
                        List.of(new CourseScheduleDTO(1L, "A", "A", "1.0", 8, 1, 2)), DEFAULT_CONFIG));

        assertThrows(BadRequestException.class, () ->
                ClassScheduleGenerator.generate(1L, LocalDate.of(2026, 10, 5),
                        List.of(new CourseScheduleDTO(1L, "BAD", "Bad", "1.0", 0, 1, 0)), DEFAULT_CONFIG));
    }
}
