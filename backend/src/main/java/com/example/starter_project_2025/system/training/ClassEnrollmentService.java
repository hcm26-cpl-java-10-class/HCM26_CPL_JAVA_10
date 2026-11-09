package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.ResolverStyle;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static com.example.starter_project_2025.system.training.TraineeImportContract.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassEnrollmentService {
    private final TrainingClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final MasterTraineeDirectory directory;
    private final Clock trainingClassClock;

    private static final Set<String> EDITABLE = Set.of("planning", "assigned", "active");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern YMD_PATTERN = Pattern.compile("^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})$");
    private static final Pattern DMY_PATTERN = Pattern.compile("^(\\d{1,2})[-/.](\\d{1,2})[-/.](\\d{4})$");
    private static final DateTimeFormatter D_MMM_Y = new DateTimeFormatterBuilder()
            .parseCaseInsensitive()
            .appendPattern("d-MMM-uuuu")
            .toFormatter(Locale.ENGLISH)
            .withResolverStyle(ResolverStyle.STRICT);

    private record Candidate(MasterTraineeDirectory.Profile profile, String studentId, String fullName,
                             String personalEmail, String dob, String gender) {}
    private record Validation(Preview preview, List<Candidate> candidates) {}

    public List<TraineeView> list(Long classId, boolean sensitive) {
        requireClass(classId, false);
        var memberships = enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(classId);
        if (memberships.isEmpty()) return List.of();
        var profiles = directory.load().stream()
                .collect(Collectors.toMap(MasterTraineeDirectory.Profile::id, p -> p, (a, b) -> b));
        return memberships.stream().map(e -> {
            var profile = profiles.get(e.getTraineeId());
            String code = firstNonBlank(e.getStudentId(), profile != null ? profile.studentId() : "");
            String fullName = firstNonBlank(e.getFullName(), profile != null ? profile.fullName() : "");
            String email = firstNonBlank(e.getPersonalEmail(), profile != null ? profile.personalEmail() : "");
            String dob = firstNonBlank(e.getDob(), profile != null ? profile.dob() : "");
            String gender = firstNonBlank(e.getGender(), profile != null ? profile.gender() : "Male");
            return new TraineeView(
                    e.getTraineeId(),
                    code,
                    code,
                    fullName,
                    email,
                    null,
                    dob,
                    gender,
                    statusLabel(e.getStatus())
            );
        }).toList();
    }

    public Preview preview(Long classId, List<Row> rows, boolean sensitive) {
        return validate(requireClass(classId, false), rows).preview();
    }

    @Transactional
    public Imported importRows(Long classId, List<Row> rows, boolean sensitive) {
        var item = requireClass(classId, true);
        var result = validate(item, rows);
        rejectInvalid(result.preview());
        insertBatch(item, result.candidates());
        return new Imported(rows.size(), enrollments.occupiedSeats(classId));
    }

    @Transactional
    public BatchResult batch(Long classId, Batch batch, boolean sensitive) {
        var item = requireClass(classId, true);
        if (batch == null || batch.created() == null || batch.updated() == null || batch.deletedIds() == null
                || batch.created().size() + batch.updated().size() + batch.deletedIds().size() > 500) {
            throw new BadRequestException("Provide created, updated and deletedIds arrays with at most 500 changes.");
        }
        var current = enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(classId).stream()
                .collect(Collectors.toMap(ClassEnrollment::getTraineeId, e -> e, (a, b) -> a));
        Set<Long> changed = new HashSet<>();
        for (Long id : batch.deletedIds()) {
            var membership = current.get(id);
            if (membership == null || !changed.add(id)) {
                throw new ConflictException("A selected enrollment no longer exists in this class or is duplicated.");
            }
            membership.setIsActive(false);
        }
        for (StatusUpdate update : batch.updated()) {
            if (update == null || update.id() == null) {
                throw new BadRequestException("Enrollment ID is required.");
            }
            var membership = current.get(update.id());
            if (membership == null || !changed.add(update.id())) {
                throw new ConflictException("A selected enrollment no longer exists in this class or is duplicated.");
            }
            membership.setStatus(parseStatus(update.status()));
        }
        enrollments.flush();
        if (!batch.created().isEmpty()) {
            var validation = validate(item, batch.created());
            rejectInvalid(validation.preview());
            insertBatch(item, validation.candidates());
        }
        if (enrollments.occupiedSeats(classId) > item.getPlannedSize()) {
            throw new ConflictException("Enrollment would exceed planned class capacity.");
        }
        return new BatchResult("Enrollment changes saved", list(classId, sensitive), enrollments.occupiedSeats(classId));
    }

    private Validation validate(TrainingClass item, List<Row> rows) {
        if (!EDITABLE.contains(item.getStatus())) {
            throw new ConflictException("Enrollment changes are allowed only for planning, assigned or active classes.");
        }
        if (rows == null || rows.isEmpty() || rows.size() > 500) {
            throw new BadRequestException("Import between 1 and 500 trainee rows.");
        }

        var pool = directory.load();
        Map<String, MasterTraineeDirectory.Profile> byCode = new HashMap<>();
        for (var p : pool) {
            if (p.studentId() != null && !p.studentId().isBlank()) {
                byCode.put(p.studentId().toUpperCase(Locale.ROOT), p);
            }
        }

        var activeMemberships = enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(item.getId());
        Set<Long> existingTraineeIds = activeMemberships.stream()
                .map(ClassEnrollment::getTraineeId)
                .collect(Collectors.toSet());
        Set<String> existingCodes = activeMemberships.stream()
                .map(e -> {
                    if (e.getStudentId() != null && !e.getStudentId().isBlank()) {
                        return e.getStudentId().toUpperCase(Locale.ROOT);
                    }
                    return pool.stream()
                            .filter(p -> Objects.equals(p.id(), e.getTraineeId()))
                            .map(p -> p.studentId().toUpperCase(Locale.ROOT))
                            .findFirst()
                            .orElse("");
                })
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());

        Map<String, Long> codeCounts = rows.stream()
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(r -> clean(r.studentId()).toUpperCase(Locale.ROOT), Collectors.counting()));

        Set<String> seenCodesInBatch = new HashSet<>();
        List<RowResult> results = new ArrayList<>();
        List<Candidate> candidates = new ArrayList<>();
        Set<Integer> rowNumbers = new HashSet<>();
        LocalDate today = LocalDate.now(trainingClassClock);

        for (int i = 0; i < rows.size(); i++) {
            Row row = rows.get(i);
            int number = row == null || row.rowNumber() == null ? i + 2 : row.rowNumber();
            Map<String, List<String>> errors = new LinkedHashMap<>();
            boolean duplicate = false;

            if (row == null) {
                error(errors, "row", "A trainee row is required.");
                results.add(new RowResult(number, false, false, errors));
                candidates.add(null);
                continue;
            }
            if (number < 2 || number > 100000 || !rowNumbers.add(number)) {
                error(errors, "rowNumber", "Use a unique Excel row number between 2 and 100000.");
            }

            String code = clean(row.studentId()).toUpperCase(Locale.ROOT);
            String fullName = clean(row.fullName());
            String email = clean(row.personalEmail());
            String rawDob = clean(row.dob());
            String rawGender = clean(row.gender());

            if (!code.matches("[A-Z0-9_-]{2,64}")) {
                error(errors, "studentId", "Student ID is required and must contain 2–64 letters, digits, underscores or hyphens.");
            }
            if (fullName.isBlank() || fullName.length() > 100) {
                error(errors, "fullName", "Full Name is required and must not exceed 100 characters.");
            }
            if (!email.isEmpty() && (email.length() > 254 || !EMAIL.matcher(email).matches())) {
                error(errors, "personalEmail", "Provide a valid email address or leave it blank.");
            }

            String normalizedDob = "";
            if (!rawDob.isEmpty()) {
                LocalDate parsedDob = parseFlexibleDate(rawDob);
                if (parsedDob == null || parsedDob.isAfter(today)) {
                    error(errors, "dob", "DOB must be a valid past date (DD/MM/YYYY or YYYY-MM-DD).");
                } else {
                    normalizedDob = parsedDob.toString();
                }
            }

            String normalizedGender = normalizeGender(rawGender);
            if (!rawGender.isEmpty() && normalizedGender == null) {
                error(errors, "gender", "Gender must be Male, Female or Other.");
            }

            if (!code.isEmpty() && codeCounts.getOrDefault(code, 0L) > 1) {
                error(errors, "studentId", "Duplicate Student ID within the file.");
                duplicate = true;
            }

            MasterTraineeDirectory.Profile existingProfile = byCode.get(code);
            if (existingProfile != null && !Set.of("active", "studying").contains(existingProfile.status().toLowerCase(Locale.ROOT))) {
                error(errors, "studentId", "The student is not active or eligible for enrollment.");
            }

            if (!code.isEmpty()) {
                boolean alreadyInClass = existingCodes.contains(code)
                        || (existingProfile != null && existingTraineeIds.contains(existingProfile.id()));
                if (alreadyInClass || !seenCodesInBatch.add(code)) {
                    if (!duplicate) {
                        error(errors, "studentId", "Student is already enrolled in this class or appears more than once in the import.");
                        duplicate = true;
                    }
                }
            }

            String finalEmail = !email.isEmpty() ? email : (existingProfile != null ? existingProfile.personalEmail() : "");
            String finalDob = !normalizedDob.isEmpty() ? normalizedDob : (existingProfile != null ? existingProfile.dob() : "");
            String finalGender = normalizedGender != null && !normalizedGender.isEmpty()
                    ? normalizedGender
                    : (existingProfile != null && !existingProfile.gender().isBlank() ? existingProfile.gender() : "Male");

            results.add(new RowResult(number, errors.isEmpty(), duplicate, errors));
            candidates.add(new Candidate(existingProfile, code, fullName, finalEmail, finalDob, finalGender));
        }

        long validCandidates = results.stream().filter(RowResult::valid).count();
        if (enrollments.occupiedSeats(item.getId()) + validCandidates > item.getPlannedSize()) {
            results = results.stream().map(r -> {
                if (!r.valid()) return r;
                Map<String, List<String>> errors = new LinkedHashMap<>(r.errors());
                error(errors, "capacity", "Import would exceed planned class capacity.");
                return new RowResult(r.rowNumber(), false, r.duplicate(), errors);
            }).toList();
        }

        int valid = (int) results.stream().filter(RowResult::valid).count();
        return new Validation(
                new Preview(
                        rows.size(),
                        valid,
                        rows.size() - valid,
                        (int) results.stream().filter(RowResult::duplicate).count(),
                        valid == rows.size(),
                        results
                ),
                candidates
        );
    }

    private void insertBatch(TrainingClass item, List<Candidate> candidates) {
        List<ClassEnrollment> batchToSave = new ArrayList<>();
        for (Candidate c : candidates) {
            if (c == null) continue;
            MasterTraineeDirectory.Profile profile = directory.provisionOrUpdate(
                    c.studentId(), c.fullName(), c.personalEmail(), c.dob(), c.gender());
            var membership = enrollments
                    .findByTrainingClass_IdAndTraineeId(item.getId(), profile.id())
                    .orElseGet(ClassEnrollment::new);
            membership.setTrainingClass(item);
            membership.setTraineeId(profile.id());
            membership.setStudentId(profile.studentId());
            membership.setFullName(c.fullName());
            membership.setPersonalEmail(c.personalEmail());
            membership.setDob(c.dob());
            membership.setGender(c.gender());
            membership.setIsActive(true);
            membership.setStatus(ClassEnrollment.Status.ACTIVE);
            batchToSave.add(membership);
        }
        enrollments.saveAll(batchToSave);
        enrollments.flush();
    }

    public static LocalDate parseFlexibleDate(String raw) {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty()) return null;
        try {
            Matcher ymd = YMD_PATTERN.matcher(s);
            if (ymd.matches()) {
                return LocalDate.of(
                        Integer.parseInt(ymd.group(1)),
                        Integer.parseInt(ymd.group(2)),
                        Integer.parseInt(ymd.group(3))
                );
            }
            Matcher dmy = DMY_PATTERN.matcher(s);
            if (dmy.matches()) {
                int first = Integer.parseInt(dmy.group(1));
                int second = Integer.parseInt(dmy.group(2));
                int year = Integer.parseInt(dmy.group(3));
                if (second >= 1 && second <= 12) {
                    return LocalDate.of(year, second, first);
                }
                if (first >= 1 && first <= 12 && second > 12) {
                    return LocalDate.of(year, first, second);
                }
                return null;
            }
            String normalizedSep = s.replaceAll("[\\s/]+", "-");
            return LocalDate.parse(normalizedSep, D_MMM_Y);
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private static String normalizeGender(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return switch (raw.trim().toLowerCase(Locale.ROOT)) {
            case "male", "m", "nam" -> "Male";
            case "female", "f", "nữ", "nu" -> "Female";
            case "other", "khác", "khac" -> "Other";
            default -> null;
        };
    }

    private TrainingClass requireClass(Long id, boolean lock) {
        var item = (lock ? classes.findForUpdate(id) : classes.findByIdAndIsActiveTrue(id))
                .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (lock && !EDITABLE.contains(item.getStatus())) {
            throw new ConflictException("This class no longer accepts enrollment changes.");
        }
        return item;
    }

    private void rejectInvalid(Preview preview) {
        if (preview.canImport()) return;
        Map<String, List<String>> errors = new LinkedHashMap<>();
        preview.rows().forEach(row ->
                row.errors().forEach((field, messages) ->
                        errors.put("rows[" + row.rowNumber() + "]." + field, messages)));
        throw new BusinessValidationException(errors);
    }

    private void error(Map<String, List<String>> errors, String field, String message) {
        errors.computeIfAbsent(field, k -> new ArrayList<>()).add(message);
    }

    private String clean(String value) {
        return value == null ? "" : value.replace('\u00A0', ' ').replaceAll("\\s+", " ").trim();
    }

    private String firstNonBlank(String a, String b) {
        return a != null && !a.isBlank() ? a : (b != null ? b : "");
    }

    private ClassEnrollment.Status parseStatus(String status) {
        return switch (clean(status)) {
            case "Active" -> ClassEnrollment.Status.ACTIVE;
            case "Inactive" -> ClassEnrollment.Status.INACTIVE;
            case "Dropped", "Dropped Out" -> ClassEnrollment.Status.DROPPED_OUT;
            default -> throw new BadRequestException("Status must be Active, Inactive or Dropped.");
        };
    }

    private String statusLabel(ClassEnrollment.Status status) {
        return switch (status) {
            case ACTIVE -> "Active";
            case INACTIVE -> "Inactive";
            case DROPPED_OUT -> "Dropped";
        };
    }
}
