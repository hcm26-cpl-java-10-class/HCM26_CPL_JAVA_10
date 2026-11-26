package com.example.starter_project_2025.system.calendar.schedule;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.calendar.schedule.ClassScheduleModels.*;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.training.ClassOperationRepository;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.ClassOperationEntity;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgram;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubject;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubjectRepository;
import com.example.starter_project_2025.system.trainingprogram.TrainingProgram;
import com.example.starter_project_2025.system.trainingprogram.TrainingProgramRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassScheduleService {

    private static final Map<String, String> LEGACY_PROGRAM_ALIASES = Map.of(
            "LOCAL_JAVA", "BACKEND_JAVA",
            "LOCAL_FULLSTACK", "FULLSTACK_JAVA"
    );

    private final TrainingClassRepository classRepository;
    private final ClassOperationRepository classOperationRepository;
    private final ClassTrainingProgramRepository classProgramRepository;
    private final TrainingProgramRepository programRepository;
    private final ProgramSubjectRepository programSubjectRepository;
    private final SubjectRepository subjectRepository;
    private final SessionRepository sessionRepository;
    private final ExternalApiService externalApiService;
    private final ScheduleConfigProvider configProvider;

    public ClassScheduleResponse getClassSchedule(Long classId) {
        TrainingClass cls = requireClass(classId, false);
        ScheduleConfigDTO config = configProvider.getConfig();
        ProgramScheduleDTO program = resolveProgramForClass(cls, config.slotHours());
        List<Session> activeSessions = findActiveNonCancelledSessions(classId);

        Map<Long, Subject> subjectCache = loadSubjectMap(activeSessions, program);
        List<ScheduleEntryDTO> rawEntries = activeSessions.stream()
                .map(s -> toEntryDto(s, config, subjectCache))
                .toList();
        List<ScheduleEntryDTO> entries = ClassScheduleGenerator.recomputeOrder(rawEntries);

        boolean hasSchedule = !entries.isEmpty();
        ClassOperationEntity op = classOperationRepository.findByTrainingClass_Id(classId).orElse(null);
        String actualStartDate = resolveActualStartDateString(op, entries);
        String actualEndDate = resolveActualEndDateString(op, entries);
        OutdatedCheck check = evaluateOutdated(cls, actualStartDate, program, activeSessions, entries);

        return new ClassScheduleResponse(
                toClassInfo(cls, actualStartDate, actualEndDate),
                program,
                config,
                hasSchedule,
                check.outdated(),
                check.reason(),
                entries
        );
    }

    public List<ScheduleEntryDTO> generateSchedule(Long classId, List<String> customHolidays, String requestedActualStartDate) {
        TrainingClass cls = requireClass(classId, false);
        ScheduleConfigDTO config = configProvider.withCustomHolidays(customHolidays);
        ProgramScheduleDTO program = resolveProgramForClass(cls, config.slotHours());
        if (program == null || program.courses() == null || program.courses().isEmpty()) {
            throw new BadRequestException("Training program has no courses.");
        }
        LocalDate effectiveStart = parseOptionalIsoDate(requestedActualStartDate, "actualStartDate");
        if (effectiveStart == null) {
            ClassOperationEntity op = classOperationRepository.findByTrainingClass_Id(classId).orElse(null);
            effectiveStart = op != null ? tryParseIsoDate(op.getActualStartDate()) : null;
        }
        if (effectiveStart == null) {
            effectiveStart = cls.getStartDate();
        }
        return ClassScheduleGenerator.generate(cls.getId(), effectiveStart, program.courses(), config);
    }

    @Transactional
    public ClassScheduleResponse saveClassSchedule(Long classId, SaveClassScheduleRequest request) {
        TrainingClass cls = requireClass(classId, true);
        ScheduleConfigDTO config = configProvider.getConfig();
        ProgramScheduleDTO program = resolveProgramForClass(cls, config.slotHours());

        List<SaveScheduleEntryInput> incoming = request == null || request.entries() == null
                ? List.of()
                : request.entries();

        LocalDate requestedActualStart = request == null ? null : parseOptionalIsoDate(request.actualStartDate(), "actualStartDate");
        LocalDate requestedActualEnd = request == null ? null : parseOptionalIsoDate(request.actualEndDate(), "actualEndDate");
        LocalDate effectiveMinDate = resolveEffectiveMinDate(cls.getStartDate(), requestedActualStart);

        Map<Integer, SlotDef> slotsByNumber = config.slots().stream()
                .collect(Collectors.toMap(SlotDef::slot, s -> s));

        Set<Long> requestedCourseIds = incoming.stream()
                .map(SaveScheduleEntryInput::courseId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Subject> subjectsById = subjectRepository.findAllById(requestedCourseIds).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));

        Set<String> occupiedDateSlots = new HashSet<>();
        List<ValidatedRow> validatedRows = new ArrayList<>(incoming.size());

        for (int i = 0; i < incoming.size(); i++) {
            SaveScheduleEntryInput item = incoming.get(i);
            if (item == null) {
                throw new BadRequestException("Invalid schedule entry #" + (i + 1) + ".");
            }
            if (item.courseId() == null || !subjectsById.containsKey(item.courseId())) {
                throw new BadRequestException("Course/Subject does not exist (courseId=" + item.courseId() + ").");
            }
            if (item.date() == null || item.date().isBlank()) {
                throw new BadRequestException("Session date is required.");
            }
            LocalDate parsedDate;
            try {
                parsedDate = LocalDate.parse(item.date().trim());
            } catch (RuntimeException ex) {
                throw new BadRequestException("Invalid date format (expected YYYY-MM-DD): " + item.date());
            }
            if (effectiveMinDate != null && parsedDate.isBefore(effectiveMinDate)) {
                throw new BadRequestException("Cannot schedule a session before the class start date (" + effectiveMinDate + ").");
            }
            LocalDate parsedActualDate = parseOptionalIsoDate(item.actualDate(), "actualDate");
            if (item.slot() == null || !slotsByNumber.containsKey(item.slot())) {
                throw new BadRequestException("Invalid slot (only 1 or 2 is allowed): " + item.slot());
            }
            String slotKey = parsedDate + "#" + item.slot();
            if (!occupiedDateSlots.add(slotKey)) {
                throw new ConflictException("Duplicate (classId, date, slot): Two sessions already occupy "
                        + parsedDate + " Slot " + item.slot() + ".");
            }
            String trimmedNote = item.note() == null || item.note().isBlank() ? null : item.note().trim();
            validatedRows.add(new ValidatedRow(
                    subjectsById.get(item.courseId()),
                    parsedDate,
                    parsedActualDate,
                    slotsByNumber.get(item.slot()),
                    Boolean.TRUE.equals(item.isManual()),
                    trimmedNote
            ));
        }

        validatedRows.sort(Comparator.comparing(ValidatedRow::date)
                .thenComparingInt(r -> r.slotDef().slot()));

        // Atomic replacement of existing sessions of this class
        List<Session> existing = sessionRepository.findByClassId(classId);
        if (!existing.isEmpty()) {
            sessionRepository.deleteAll(existing);
            sessionRepository.flush();
        }

        Long resolvedTrainerId = resolveDefaultTrainerId(cls);
        String programSnapshot = program != null ? program.code() : (cls.getProgram() != null ? cls.getProgram().trim() : null);
        String location = cls.getLocation() != null && !cls.getLocation().isBlank() ? cls.getLocation().trim() : null;
        if (location != null && location.length() > 150) {
            location = location.substring(0, 150);
        }

        Map<Long, Integer> orderByCourse = new HashMap<>();
        List<Session> toSave = new ArrayList<>(validatedRows.size());

        for (ValidatedRow row : validatedRows) {
            int order = orderByCourse.merge(row.subject().getId(), 1, Integer::sum);
            LocalTime startTime = LocalTime.parse(row.slotDef().start());
            LocalTime endTime = LocalTime.parse(row.slotDef().end());

            String rawTitle = "[" + row.subject().getCode() + "] " + row.subject().getName() + " - Session " + order;
            String safeTitle = rawTitle.length() > 150 ? rawTitle.substring(0, 150) : rawTitle;

            Session session = new Session();
            session.setClassId(classId);
            session.setTopicId(row.subject().getId());
            session.setTrainerId(resolvedTrainerId);
            session.initializeForSchedule(safeTitle, location);
            session.scheduleSlot(LocalDateTime.of(row.date(), startTime), LocalDateTime.of(row.date(), endTime));
            session.setSlotNumber(row.slotDef().slot());
            session.setSessionOrder(order);
            session.setIsManual(row.isManual());
            session.setNote(row.note());
            session.setProgramSnapshot(programSnapshot);
            session.setClassStartSnapshot(cls.getStartDate());
            session.setActualDate(row.actualDate());
            toSave.add(session);
        }

        if (!toSave.isEmpty()) {
            sessionRepository.saveAll(toSave);
            sessionRepository.flush();
        }

        syncClassOperationActualDates(cls, validatedRows, requestedActualStart, requestedActualEnd);

        return getClassSchedule(classId);
    }

    private record ValidatedRow(Subject subject, LocalDate date, LocalDate actualDate, SlotDef slotDef, boolean isManual, String note) {}
    private record OutdatedCheck(boolean outdated, String reason) {}

    private TrainingClass requireClass(Long classId, boolean lock) {
        return (lock ? classRepository.findForUpdate(classId) : classRepository.findByIdAndIsActiveTrue(classId))
                .filter(c -> Boolean.TRUE.equals(c.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Class not found with ID: " + classId));
    }

    private List<Session> findActiveNonCancelledSessions(Long classId) {
        return sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && s.getStatus() != Session.SessionStatus.CANCELLED)
                .sorted(Comparator.comparing(Session::getStartTime).thenComparing(Session::getId))
                .toList();
    }

    private ProgramScheduleDTO resolveProgramForClass(TrainingClass cls, int slotHours) {
        TrainingProgram matchedProgram = classProgramRepository.findByClassId(cls.getId())
                .filter(link -> Boolean.TRUE.equals(link.getIsActive()) && link.getProgram() != null)
                .map(ClassTrainingProgram::getProgram)
                .orElseGet(() -> matchProgramByText(cls.getProgram()));

        if (matchedProgram == null) {
            return null;
        }

        List<ProgramSubject> programSubjects = programSubjectRepository
                .findByProgram_IdOrderByOrderIndexAsc(matchedProgram.getId());

        List<CourseScheduleDTO> courses = new ArrayList<>();
        int totalHours = 0;
        int fallbackIdx = 1;
        for (ProgramSubject ps : programSubjects) {
            Subject subj = ps.getSubject();
            if (subj == null) continue;
            Long subjectId = subj.getId();
            String code = ps.resolveCode() != null ? ps.resolveCode() : subj.getCode();
            String name = ps.resolveName() != null ? ps.resolveName() : subj.getName();
            String ver = ps.resolveVersion() != null ? ps.resolveVersion() : subj.getVersion();
            Integer hours = ps.resolveDurationHours();
            int orderIdx = ps.getOrderIndex() != null ? ps.getOrderIndex() : fallbackIdx;
            int slotsNeeded = hours != null && hours > 0 ? (int) Math.ceil((double) hours / Math.max(1, slotHours)) : 0;
            if (hours != null && hours > 0) {
                totalHours += hours;
            }
            courses.add(new CourseScheduleDTO(subjectId, code, name, ver, hours, orderIdx, slotsNeeded));
            fallbackIdx++;
        }

        return new ProgramScheduleDTO(
                matchedProgram.getId(),
                matchedProgram.getCode(),
                matchedProgram.getName(),
                matchedProgram.getVersion(),
                totalHours,
                courses
        );
    }

    private TrainingProgram matchProgramByText(String rawProgram) {
        if (rawProgram == null || rawProgram.isBlank()) {
            return null;
        }
        String normalized = rawProgram.trim();
        String aliased = LEGACY_PROGRAM_ALIASES.getOrDefault(normalized.toUpperCase(Locale.ROOT), normalized);

        List<TrainingProgram> all = programRepository.findAll().stream()
                .filter(p -> Boolean.TRUE.equals(p.getIsActive()))
                .sorted(Comparator.comparing(TrainingProgram::getId))
                .toList();

        return all.stream()
                .filter(p -> equalsIgnoreCaseTrim(p.getCode(), normalized) || equalsIgnoreCaseTrim(p.getName(), normalized))
                .findFirst()
                .or(() -> all.stream()
                        .filter(p -> equalsIgnoreCaseTrim(p.getCode(), aliased) || equalsIgnoreCaseTrim(p.getName(), aliased))
                        .findFirst())
                .orElse(null);
    }

    private static boolean equalsIgnoreCaseTrim(String a, String b) {
        return a != null && b != null && a.trim().equalsIgnoreCase(b.trim());
    }

    private Map<Long, Subject> loadSubjectMap(List<Session> sessions, ProgramScheduleDTO program) {
        Set<Long> ids = new HashSet<>();
        sessions.forEach(s -> {
            if (s.getTopicId() != null) ids.add(s.getTopicId());
        });
        if (program != null && program.courses() != null) {
            program.courses().forEach(c -> {
                if (c.id() != null) ids.add(c.id());
            });
        }
        if (ids.isEmpty()) return Map.of();
        return subjectRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));
    }

    private ScheduleEntryDTO toEntryDto(Session s, ScheduleConfigDTO config, Map<Long, Subject> subjectMap) {
        LocalDate date = s.getStartTime().toLocalDate();
        int slot = s.getSlotNumber() != null
                ? s.getSlotNumber()
                : (s.getStartTime().getHour() < 12 ? 1 : 2);
        SlotDef slotDef = config.slots().stream()
                .filter(sd -> sd.slot() == slot)
                .findFirst()
                .orElseGet(() -> new SlotDef(slot, s.getStartTime().toLocalTime().toString(), s.getEndTime().toLocalTime().toString()));

        Subject subj = subjectMap.get(s.getTopicId());
        String courseCode = subj != null ? subj.getCode() : extractBracketCode(s.getTitle());
        String courseName = subj != null ? subj.getName() : s.getTitle();

        return new ScheduleEntryDTO(
                "session-" + s.getId(),
                s.getClassId(),
                s.getTopicId(),
                courseCode,
                courseName,
                date.toString(),
                s.getActualDate() != null ? s.getActualDate().toString() : null,
                slot,
                slotDef.start(),
                slotDef.end(),
                s.getSessionOrder() != null ? s.getSessionOrder() : 1,
                Boolean.TRUE.equals(s.getIsManual()),
                s.getNote()
        );
    }

    private static String extractBracketCode(String title) {
        if (title != null && title.startsWith("[") && title.contains("]")) {
            return title.substring(1, title.indexOf(']')).trim();
        }
        return "";
    }

    private OutdatedCheck evaluateOutdated(
            TrainingClass cls,
            String actualStartDate,
            ProgramScheduleDTO program,
            List<Session> activeSessions,
            List<ScheduleEntryDTO> entries
    ) {
        if (entries.isEmpty()) {
            return new OutdatedCheck(false, null);
        }

        LocalDate effectiveMinDate = resolveEffectiveMinDate(cls.getStartDate(), tryParseIsoDate(actualStartDate));
        for (Session s : activeSessions) {
            if (s.getClassStartSnapshot() != null && cls.getStartDate() != null
                    && !s.getClassStartSnapshot().equals(cls.getStartDate())) {
                return new OutdatedCheck(true, "The class start date changed after saving. This schedule may be outdated and should be regenerated.");
            }
            if (s.getProgramSnapshot() != null && program != null
                    && !s.getProgramSnapshot().equalsIgnoreCase(program.code())) {
                return new OutdatedCheck(true, "The class Training Program changed after saving. This schedule may be outdated and should be regenerated.");
            }
            if (effectiveMinDate != null && s.getStartTime().toLocalDate().isBefore(effectiveMinDate)) {
                return new OutdatedCheck(true, "Some sessions fall before the current class start date. This schedule may be outdated and should be regenerated.");
            }
        }

        if (program != null && program.courses() != null && !program.courses().isEmpty()) {
            Set<Long> programCourseIds = program.courses().stream()
                    .map(CourseScheduleDTO::id)
                    .collect(Collectors.toSet());
            boolean hasForeignCourse = entries.stream()
                    .anyMatch(e -> !programCourseIds.contains(e.courseId()));
            if (hasForeignCourse) {
                return new OutdatedCheck(true, "The schedule contains courses not belonging to the current Training Program. Consider regenerating.");
            }
        }

        return new OutdatedCheck(false, null);
    }

    private Long resolveDefaultTrainerId(TrainingClass cls) {
        if (cls.getMasterTrainerId() != null && cls.getMasterTrainerId() > 0) {
            return cls.getMasterTrainerId();
        }
        if (cls.getMasterTrainer() != null && !cls.getMasterTrainer().isBlank()) {
            try {
                List<ExternalTrainerDTO> trainers = externalApiService.fetchTrainers(null);
                if (trainers != null) {
                    String target = cls.getMasterTrainer().trim();
                    for (ExternalTrainerDTO t : trainers) {
                        if (t != null && t.getId() != null &&
                                (equalsIgnoreCaseTrim(t.getName(), target) || equalsIgnoreCaseTrim(t.getEmail(), target))) {
                            return t.getId();
                        }
                    }
                }
            } catch (RuntimeException ex) {
                log.debug("Could not resolve external trainer for class {}: {}", cls.getCode(), ex.getMessage());
            }
        }
        return 0L;
    }

    private void syncClassOperationActualDates(
            TrainingClass cls,
            List<ValidatedRow> validatedRows,
            LocalDate requestedActualStart,
            LocalDate requestedActualEnd
    ) {
        LocalDate computedStart = requestedActualStart;
        if (computedStart == null && !validatedRows.isEmpty()) {
            computedStart = validatedRows.get(0).date();
        }
        LocalDate computedEnd = requestedActualEnd;
        if (computedEnd == null && !validatedRows.isEmpty()) {
            computedEnd = validatedRows.get(validatedRows.size() - 1).date();
        }
        if (computedStart == null && computedEnd == null) {
            return;
        }
        ClassOperationEntity op = classOperationRepository.findByTrainingClass_Id(cls.getId())
                .orElseGet(() -> ClassOperationEntity.builder()
                        .trainingClass(cls)
                        .hasNoAllocationNeeds(false)
                        .build());
        if (computedStart != null) {
            op.setActualStartDate(computedStart.toString());
        }
        if (computedEnd != null) {
            op.setActualEndDate(computedEnd.toString());
        }
        classOperationRepository.save(op);
    }

    private static LocalDate parseOptionalIsoDate(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (RuntimeException ex) {
            throw new BadRequestException("Invalid " + fieldName + " format (expected YYYY-MM-DD): " + raw);
        }
    }

    private static LocalDate tryParseIsoDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.trim());
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static LocalDate resolveEffectiveMinDate(LocalDate classStart, LocalDate actualStart) {
        if (classStart == null) return actualStart;
        if (actualStart == null) return classStart;
        return actualStart.isBefore(classStart) ? actualStart : classStart;
    }

    private static String resolveActualStartDateString(ClassOperationEntity op, List<ScheduleEntryDTO> entries) {
        if (op != null && op.getActualStartDate() != null && !op.getActualStartDate().isBlank()) {
            return op.getActualStartDate().trim();
        }
        return entries.isEmpty() ? null : entries.get(0).date();
    }

    private static String resolveActualEndDateString(ClassOperationEntity op, List<ScheduleEntryDTO> entries) {
        if (op != null && op.getActualEndDate() != null && !op.getActualEndDate().isBlank()) {
            return op.getActualEndDate().trim();
        }
        return entries.isEmpty() ? null : entries.get(entries.size() - 1).date();
    }

    private static ClassScheduleInfoDTO toClassInfo(TrainingClass cls, String actualStartDate, String actualEndDate) {
        return new ClassScheduleInfoDTO(
                cls.getId(),
                cls.getCode(),
                cls.getName(),
                cls.getStartDate(),
                cls.getEndDate(),
                actualStartDate,
                actualEndDate,
                cls.getStatus(),
                cls.getProgram(),
                cls.getMasterTrainer(),
                cls.getLocation()
        );
    }
}
