package com.example.starter_project_2025.system.calendar.schedule;

import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.ScheduleConfigDTO;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.SlotDef;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

@Component
public class ScheduleConfigProvider {

    private final int slotHours;
    private final String slot1Start;
    private final String slot1End;
    private final String slot2Start;
    private final String slot2End;
    private final List<Integer> workingDays;
    private final List<String> holidays;

    public ScheduleConfigProvider(
            @Value("${app.calendar.schedule.slot-hours:4}") int slotHours,
            @Value("${app.calendar.schedule.slot1-start:08:00}") String slot1Start,
            @Value("${app.calendar.schedule.slot1-end:12:00}") String slot1End,
            @Value("${app.calendar.schedule.slot2-start:13:00}") String slot2Start,
            @Value("${app.calendar.schedule.slot2-end:17:00}") String slot2End,
            @Value("${app.calendar.schedule.working-days:1,2,3,4,5}") String workingDaysRaw,
            @Value("${app.calendar.schedule.holidays:}") String holidaysRaw
    ) {
        this.slotHours = slotHours > 0 ? slotHours : 4;
        this.slot1Start = slot1Start;
        this.slot1End = slot1End;
        this.slot2Start = slot2Start;
        this.slot2End = slot2End;
        this.workingDays = parseWorkingDays(workingDaysRaw);
        this.holidays = parseHolidays(holidaysRaw);
    }

    public ScheduleConfigDTO getConfig() {
        return new ScheduleConfigDTO(
                slotHours,
                List.of(
                        new SlotDef(1, slot1Start, slot1End),
                        new SlotDef(2, slot2Start, slot2End)
                ),
                workingDays,
                holidays
        );
    }

    public ScheduleConfigDTO withCustomHolidays(List<String> customHolidays) {
        if (customHolidays == null) {
            return getConfig();
        }
        List<String> normalized = customHolidays.stream()
                .filter(h -> h != null && !h.isBlank())
                .map(String::trim)
                .filter(ScheduleConfigProvider::isValidIsoDate)
                .distinct()
                .sorted()
                .toList();
        return new ScheduleConfigDTO(
                slotHours,
                List.of(
                        new SlotDef(1, slot1Start, slot1End),
                        new SlotDef(2, slot2Start, slot2End)
                ),
                workingDays,
                normalized
        );
    }

    private static List<Integer> parseWorkingDays(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of(1, 2, 3, 4, 5);
        }
        List<Integer> parsed = Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Integer::parseInt)
                .filter(d -> d >= 1 && d <= 7)
                .distinct()
                .sorted()
                .toList();
        return parsed.isEmpty() ? List.of(1, 2, 3, 4, 5) : parsed;
    }

    private static List<String> parseHolidays(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(ScheduleConfigProvider::isValidIsoDate)
                .distinct()
                .sorted()
                .toList();
    }

    private static boolean isValidIsoDate(String value) {
        try {
            LocalDate.parse(value);
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
