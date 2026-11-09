package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.training.entity.ClassActivityEntity;
import com.example.starter_project_2025.system.training.entity.ClassOperationEntity;
import com.example.starter_project_2025.system.training.entity.ClassTopicAssessmentEntity;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgram;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubject;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClassOperationDatabaseService {

    private final ClassOperationRepository operationRepository;
    private final ClassTopicAssessmentRepository topicAssessmentRepository;
    private final ClassActivityEntityRepository activityRepository;
    private final TrainingClassRepository trainingClassRepository;
    private final SessionRepository sessionRepository;
    private final ClassTrainingProgramRepository classTrainingProgramRepository;
    private final SubjectRepository subjectRepository;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter MONTH_LABEL_FMT = DateTimeFormatter.ofPattern("MMM - yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter ACTIVITY_TS_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm:ss", Locale.ENGLISH);

    // =========================================================================
    // 1. OPERATION & MILESTONES (QUERYING & PERSISTING IN H2 DATABASE)
    // =========================================================================

    @Transactional
    public Map<String, Object> getOperation(Long classId) {
        ClassOperationEntity entity = operationRepository.findByClassId(classId)
                .orElseGet(() -> initializeOperationFromH2(classId));
        return toOperationMap(entity);
    }

    @Transactional
    public Map<String, Object> saveOperation(Long classId, Map<String, Object> body) {
        ClassOperationEntity entity = operationRepository.findByClassId(classId)
                .orElseGet(() -> initializeOperationFromH2(classId));

        Map<String, Object> opInfo = (Map<String, Object>) body.get("operatingInfo");
        if (opInfo != null) {
            if (opInfo.get("actualStartDate") != null) entity.setActualStartDate(String.valueOf(opInfo.get("actualStartDate")));
            if (opInfo.get("earlyGraduatedDate") != null) entity.setEarlyGraduatedDate(String.valueOf(opInfo.get("earlyGraduatedDate")));
            if (opInfo.get("actualEndDate") != null) entity.setActualEndDate(String.valueOf(opInfo.get("actualEndDate")));
            if (opInfo.get("hasNoAllocationNeeds") != null) {
                entity.setHasNoAllocationNeeds(Boolean.parseBoolean(String.valueOf(opInfo.get("hasNoAllocationNeeds"))));
            }

            Map<String, Object> gpa = (Map<String, Object>) opInfo.get("gpaCalculation");
            if (gpa != null) {
                if (gpa.get("topicMark") != null) entity.setTopicMark(Integer.parseInt(String.valueOf(gpa.get("topicMark"))));
                if (gpa.get("disciplinePoint") != null) entity.setDisciplinePoint(Integer.parseInt(String.valueOf(gpa.get("disciplinePoint"))));
                if (gpa.get("bonusPoint") != null) entity.setBonusPoint(Integer.parseInt(String.valueOf(gpa.get("bonusPoint"))));
                if (gpa.get("penaltyPoint") != null) entity.setPenaltyPoint(Integer.parseInt(String.valueOf(gpa.get("penaltyPoint"))));
            }
        }

        Object milestones = body.get("milestones");
        if (milestones != null) {
            try {
                entity.setMilestonesJson(objectMapper.writeValueAsString(milestones));
            } catch (Exception e) {
                log.error("Failed to serialize milestones to JSON", e);
            }
        }

        if (body.get("totalWeightedNumber") != null) {
            entity.setTotalWeightedNumber(Integer.parseInt(String.valueOf(body.get("totalWeightedNumber"))));
        }

        ClassOperationEntity saved = operationRepository.save(entity);
        return toOperationMap(saved);
    }

    // =========================================================================
    // 2. TOPIC ASSESSMENTS CONFIGURATION (H2 DATABASE)
    // =========================================================================

    @Transactional
    public List<Map<String, Object>> getTopicAssessments(Long classId) {
        List<ClassTopicAssessmentEntity> list = topicAssessmentRepository.findByClassIdOrderByTopicIndexAsc(classId);
        if (list.isEmpty()) {
            list = initializeTopicAssessmentsFromH2(classId);
        }
        return list.stream().map(this::toTopicMap).toList();
    }

    @Transactional
    public List<Map<String, Object>> saveTopicAssessments(Long classId, Map<String, Object> body) {
        String action = body.get("action") != null ? String.valueOf(body.get("action")) : "confirm";
        List<Map<String, Object>> incomingTopics = (List<Map<String, Object>>) body.get("topics");
        if (incomingTopics == null) {
            return getTopicAssessments(classId);
        }

        List<ClassTopicAssessmentEntity> existingList = topicAssessmentRepository.findByClassIdOrderByTopicIndexAsc(classId);
        Map<Integer, ClassTopicAssessmentEntity> existingByIndex = new HashMap<>();
        for (ClassTopicAssessmentEntity existing : existingList) {
            if (existing.getTopicIndex() != null) {
                existingByIndex.put(existing.getTopicIndex(), existing);
            }
        }

        List<ClassTopicAssessmentEntity> updatedEntities = new ArrayList<>();
        int index = 1;
        for (Map<String, Object> t : incomingTopics) {
            String title = (String) t.get("title");
            List<Map<String, Object>> assessments = (List<Map<String, Object>>) t.get("assessments");
            if (assessments == null) assessments = new ArrayList<>();

            for (Map<String, Object> a : assessments) {
                String currentStatus = (String) a.get("changeStatus");
                if ("confirm".equalsIgnoreCase(action)) {
                    if ("waiting".equalsIgnoreCase(currentStatus)) {
                        a.put("changeStatus", "confirmed");
                    }
                } else if ("reject".equalsIgnoreCase(action)) {
                    a.put("changeStatus", "none");
                }
            }

            String json;
            try {
                json = objectMapper.writeValueAsString(assessments);
            } catch (Exception e) {
                json = "[]";
            }

            ClassTopicAssessmentEntity entity = existingByIndex.get(index);
            if (entity == null) {
                entity = ClassTopicAssessmentEntity.builder()
                        .classId(classId)
                        .topicIndex(index)
                        .title(title)
                        .assessmentsJson(json)
                        .build();
            } else {
                entity.setTitle(title);
                entity.setAssessmentsJson(json);
            }

            updatedEntities.add(topicAssessmentRepository.save(entity));
            index++;
        }

        if ("confirm".equalsIgnoreCase(action)) {
            syncMilestoneWeightsWithTopicAssessments(classId, incomingTopics);
        }

        return updatedEntities.stream().map(this::toTopicMap).toList();
    }

    private void syncMilestoneWeightsWithTopicAssessments(Long classId, List<Map<String, Object>> incomingTopics) {
        ClassOperationEntity opEntity = operationRepository.findByClassId(classId)
                .orElseGet(() -> initializeOperationFromH2(classId));
        if (opEntity.getMilestonesJson() == null || opEntity.getMilestonesJson().isBlank()) {
            return;
        }

        Map<String, Double> topicCodePercentMap = new HashMap<>();
        for (Map<String, Object> t : incomingTopics) {
            String title = t.get("title") != null ? String.valueOf(t.get("title")) : "";
            List<Map<String, Object>> assessments = (List<Map<String, Object>>) t.get("assessments");
            double sumPercent = 0;
            if (assessments != null) {
                for (Map<String, Object> a : assessments) {
                    Object w = a.get("weightedNumber");
                    if (w != null) {
                        try {
                            sumPercent += Double.parseDouble(String.valueOf(w));
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }
            String code = extractTopicCode(title);
            if (!code.isEmpty()) {
                topicCodePercentMap.put(code, sumPercent);
            }
        }

        try {
            List<Map<String, Object>> milestones = objectMapper.readValue(
                    opEntity.getMilestonesJson(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );
            int newTotalWeighted = 0;
            for (Map<String, Object> m : milestones) {
                List<Map<String, Object>> mTopics = (List<Map<String, Object>>) m.get("topics");
                if (mTopics == null) continue;
                for (Map<String, Object> mt : mTopics) {
                    String mTopicName = mt.get("topic") != null ? String.valueOf(mt.get("topic")) : "";
                    int currentWeight = mt.get("weightedNumber") != null
                            ? Integer.parseInt(String.valueOf(mt.get("weightedNumber")))
                            : 0;
                    int baseWeight = mt.get("baseWeightedNumber") != null
                            ? Integer.parseInt(String.valueOf(mt.get("baseWeightedNumber")))
                            : currentWeight;
                    mt.put("baseWeightedNumber", baseWeight);

                    String code = extractTopicCode(mTopicName);
                    if (topicCodePercentMap.containsKey(code)) {
                        double pct = topicCodePercentMap.get(code);
                        int updatedWeight = (int) Math.round(baseWeight * (pct / 100.0));
                        mt.put("weightedNumber", updatedWeight);
                        newTotalWeighted += updatedWeight;
                    } else {
                        newTotalWeighted += currentWeight;
                    }
                }
            }
            opEntity.setMilestonesJson(objectMapper.writeValueAsString(milestones));
            opEntity.setTotalWeightedNumber(newTotalWeighted);
            operationRepository.save(opEntity);
        } catch (Exception e) {
            log.error("Failed to sync milestone weights with topic assessments in H2", e);
        }
    }

    // =========================================================================
    // 3. CLASS ACTIVITIES & AUDIT LOGS (H2 DATABASE)
    // =========================================================================

    @Transactional
    public List<ClassActivityEntity> getActivities(Long classId) {
        List<ClassActivityEntity> list = activityRepository.findByClassIdOrderByIdDesc(classId);
        if (list.isEmpty()) {
            list = initializeActivitiesFromH2(classId);
        }
        return list;
    }

    @Transactional
    public ClassActivityEntity addActivity(Long classId, Map<String, Object> body) {
        String author = body.get("author") != null ? String.valueOf(body.get("author")) : resolveDefaultActor(classId);
        String content = body.get("content") != null ? String.valueOf(body.get("content")) : "";
        String type = body.get("type") != null ? String.valueOf(body.get("type")) : "comment";
        String initials = buildInitials(author);
        String now = LocalDateTime.now().format(ACTIVITY_TS_FMT);

        ClassActivityEntity entity = ClassActivityEntity.builder()
                .classId(classId)
                .author(author)
                .initials(initials)
                .content(content)
                .timestamp(now)
                .type(type)
                .build();

        return activityRepository.save(entity);
    }

    // =========================================================================
    // DYNAMIC H2 INITIALIZATION FROM TRAINING_CLASSES, SESSIONS & SUBJECTS
    // =========================================================================

    private record TopicDescriptor(String code, String displayName, int totalHours, int sessionCount) {}

    private List<TopicDescriptor> resolveTopicsFromH2(Long classId) {
        Map<String, TopicDescriptor> byCode = new LinkedHashMap<>();

        // 1. Check linked ClassTrainingProgram -> ProgramSubject -> Subject in H2
        Optional<ClassTrainingProgram> programLink = classTrainingProgramRepository.findByClassId(classId);
        if (programLink.isPresent() && programLink.get().getProgram() != null) {
            List<ProgramSubject> programSubjects = programLink.get().getProgram().getSubjects();
            if (programSubjects != null) {
                programSubjects.stream()
                        .sorted(Comparator.comparing(ps -> ps.getOrderIndex() != null ? ps.getOrderIndex() : 0))
                        .forEach(ps -> {
                            String code = ps.resolveCode() != null ? ps.resolveCode() : "TOPIC_" + ps.getId();
                            String ver = ps.resolveVersion() != null ? ps.resolveVersion() : "1.0";
                            String name = String.format("[%s] %s (%s)", code, ps.resolveName(), ver);
                            int hours = ps.resolveDurationHours() != null ? ps.resolveDurationHours() : 24;
                            byCode.put(code, new TopicDescriptor(code, name, hours, Math.max(1, hours / 4)));
                        });
            }
        }

        // 2. Inspect actual scheduled Session rows for this class in H2 `sessions` table
        List<Session> classSessions = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .sorted(Comparator.comparing(Session::getStartTime))
                .toList();

        Map<String, Integer> hoursByCode = new LinkedHashMap<>();
        Map<String, Integer> countByCode = new LinkedHashMap<>();
        Map<String, String> labelByCode = new LinkedHashMap<>();

        for (Session s : classSessions) {
            String code = extractTopicCode(s.getTitle());
            if (code.isEmpty()) {
                code = "TOPIC_" + s.getTopicId();
            }
            int sessionHours = 4;
            if (s.getStartTime() != null && s.getEndTime() != null) {
                long h = Duration.between(s.getStartTime(), s.getEndTime()).toHours();
                if (h > 0) sessionHours = (int) h;
            }
            hoursByCode.merge(code, sessionHours, Integer::sum);
            countByCode.merge(code, 1, Integer::sum);
            labelByCode.putIfAbsent(code, formatTopicDisplayNameFromSession(code, s.getTitle()));
        }

        for (Map.Entry<String, Integer> entry : hoursByCode.entrySet()) {
            String code = entry.getKey();
            if (!byCode.containsKey(code)) {
                byCode.put(code, new TopicDescriptor(
                        code,
                        labelByCode.get(code),
                        entry.getValue(),
                        countByCode.getOrDefault(code, 1)
                ));
            }
        }

        // 3. Also include active Subject entities from H2 `subjects` table if present
        for (Subject subj : subjectRepository.findAll()) {
            if (Boolean.TRUE.equals(subj.getIsActive()) && subj.getCode() != null && !byCode.containsKey(subj.getCode())) {
                int hours = subj.getDurationHours() != null ? subj.getDurationHours() : 24;
                String display = String.format("[%s] %s (%s)", subj.getCode(), subj.getName(), subj.getVersion() != null ? subj.getVersion() : "1.0");
                byCode.put(subj.getCode(), new TopicDescriptor(subj.getCode(), display, hours, Math.max(1, hours / 4)));
            }
        }

        return new ArrayList<>(byCode.values());
    }

    @Transactional
    public ClassOperationEntity initializeOperationFromH2(Long classId) {
        Optional<ClassOperationEntity> existing = operationRepository.findByClassId(classId);
        if (existing.isPresent()) {
            return existing.get();
        }

        TrainingClass tc = trainingClassRepository.findById(classId).orElse(null);
        LocalDate startDate = tc != null && tc.getStartDate() != null ? tc.getStartDate() : LocalDate.now().withDayOfMonth(1);
        LocalDate endDate = tc != null && tc.getEndDate() != null ? tc.getEndDate() : startDate.plusMonths(3).withDayOfMonth(28);

        List<Session> classSessions = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && s.getStartTime() != null)
                .sorted(Comparator.comparing(Session::getStartTime))
                .toList();

        List<TopicDescriptor> allTopics = resolveTopicsFromH2(classId);

        // Group sessions by YearMonth from H2 `sessions` table, or distribute across class months
        Map<YearMonth, Map<String, Integer>> monthTopicHours = new LinkedHashMap<>();
        Map<String, String> topicDisplayMap = new LinkedHashMap<>();
        for (TopicDescriptor td : allTopics) {
            topicDisplayMap.put(td.code(), td.displayName());
        }

        for (Session s : classSessions) {
            YearMonth ym = YearMonth.from(s.getStartTime());
            String code = extractTopicCode(s.getTitle());
            if (code.isEmpty()) code = "TOPIC_" + s.getTopicId();
            topicDisplayMap.putIfAbsent(code, formatTopicDisplayNameFromSession(code, s.getTitle()));
            int hours = 4;
            if (s.getEndTime() != null) {
                long h = Duration.between(s.getStartTime(), s.getEndTime()).toHours();
                if (h > 0) hours = (int) h;
            }
            monthTopicHours.computeIfAbsent(ym, k -> new LinkedHashMap<>())
                    .merge(code, hours, Integer::sum);
        }

        // Ensure every month in the TrainingClass's [startDate, endDate] range has a Milestone
        YearMonth startYm = YearMonth.from(startDate);
        YearMonth endYm = YearMonth.from(endDate);
        YearMonth cursor = startYm;
        int topicCursor = 0;
        while (!cursor.isAfter(endYm)) {
            if (!monthTopicHours.containsKey(cursor) && !allTopics.isEmpty()) {
                TopicDescriptor td = allTopics.get(topicCursor % allTopics.size());
                Map<String, Integer> map = new LinkedHashMap<>();
                map.put(td.code(), td.totalHours());
                monthTopicHours.put(cursor, map);
                topicCursor++;
            }
            cursor = cursor.plusMonths(1);
        }

        List<Map<String, Object>> milestones = new ArrayList<>();
        int milestoneId = 1;
        int totalWeighted = 0;

        List<YearMonth> sortedMonths = new ArrayList<>(monthTopicHours.keySet());
        Collections.sort(sortedMonths);

        for (YearMonth ym : sortedMonths) {
            Map<String, Integer> topicsInMonth = monthTopicHours.get(ym);
            if (topicsInMonth == null || topicsInMonth.isEmpty()) continue;

            LocalDate mStart = ym.equals(startYm) ? startDate : ym.atDay(1);
            LocalDate mEnd = ym.equals(endYm) ? endDate : ym.atEndOfMonth();

            List<Map<String, Object>> topicRows = new ArrayList<>();
            int subIdx = 1;
            for (Map.Entry<String, Integer> e : topicsInMonth.entrySet()) {
                String code = e.getKey();
                int hours = e.getValue();
                // Weight derived from H2 session hours * planned class size (or standard factor 30)
                int factor = tc != null && tc.getPlannedSize() != null ? tc.getPlannedSize() : 25;
                int weight = hours * factor;
                totalWeighted += weight;

                Map<String, Object> tRow = new LinkedHashMap<>();
                tRow.put("id", milestoneId * 100 + subIdx++);
                tRow.put("topic", topicDisplayMap.getOrDefault(code, "[" + code + "] " + code));
                tRow.put("maxScore", 10);
                tRow.put("passingScore", 6);
                tRow.put("weightedNumber", weight);
                tRow.put("baseWeightedNumber", weight);
                topicRows.add(tRow);
            }

            Map<String, Object> milestone = new LinkedHashMap<>();
            milestone.put("id", milestoneId++);
            milestone.put("name", ym.format(MONTH_LABEL_FMT));
            milestone.put("status", "Baselined");
            milestone.put("checkpointType", "STANDARD");
            milestone.put("salaryPaid", "Yes");
            milestone.put("startDate", mStart.toString());
            milestone.put("endDate", mEnd.toString());
            milestone.put("topics", topicRows);
            milestones.add(milestone);
        }

        String milestonesJson;
        try {
            milestonesJson = objectMapper.writeValueAsString(milestones);
        } catch (Exception e) {
            milestonesJson = "[]";
        }

        ClassOperationEntity entity = ClassOperationEntity.builder()
                .classId(classId)
                .actualStartDate(startDate.toString())
                .earlyGraduatedDate(endDate.toString())
                .actualEndDate("")
                .topicMark(70)
                .disciplinePoint(30)
                .bonusPoint(10)
                .penaltyPoint(20)
                .hasNoAllocationNeeds(false)
                .milestonesJson(milestonesJson)
                .totalWeightedNumber(totalWeighted)
                .build();

        return operationRepository.save(entity);
    }

    @Transactional
    public List<ClassTopicAssessmentEntity> initializeTopicAssessmentsFromH2(Long classId) {
        List<ClassTopicAssessmentEntity> existing = topicAssessmentRepository.findByClassIdOrderByTopicIndexAsc(classId);
        if (!existing.isEmpty()) {
            return existing;
        }

        List<TopicDescriptor> topics = resolveTopicsFromH2(classId);
        List<ClassTopicAssessmentEntity> savedList = new ArrayList<>();
        int index = 1;

        for (TopicDescriptor td : topics) {
            String title = index + ". " + td.displayName();
            int labQty = Math.max(1, td.sessionCount() / 2);

            List<Map<String, Object>> assessments = new ArrayList<>();
            Map<String, Object> a1 = new LinkedHashMap<>();
            a1.put("id", index * 100 + 1);
            a1.put("name", "Assignments / Lab Practice");
            a1.put("weightedNumber", 30);
            a1.put("quantity", labQty);
            a1.put("note", "(" + labQty + " lab sessions in H2)");
            a1.put("action", "Keep");
            a1.put("changeStatus", "none");

            Map<String, Object> a2 = new LinkedHashMap<>();
            a2.put("id", index * 100 + 2);
            a2.put("name", "Final Theory Test");
            a2.put("weightedNumber", 30);
            a2.put("quantity", 1);
            a2.put("note", "");
            a2.put("action", "Keep");
            a2.put("changeStatus", "confirmed");

            Map<String, Object> a3 = new LinkedHashMap<>();
            a3.put("id", index * 100 + 3);
            a3.put("name", "Final Practical Assessment");
            a3.put("weightedNumber", 40);
            a3.put("quantity", 1);
            a3.put("note", "");
            a3.put("action", "Keep");
            a3.put("changeStatus", "none");

            assessments.add(a1);
            assessments.add(a2);
            assessments.add(a3);

            String json;
            try {
                json = objectMapper.writeValueAsString(assessments);
            } catch (Exception e) {
                json = "[]";
            }

            ClassTopicAssessmentEntity entity = ClassTopicAssessmentEntity.builder()
                    .classId(classId)
                    .topicIndex(index)
                    .title(title)
                    .assessmentsJson(json)
                    .build();

            savedList.add(topicAssessmentRepository.save(entity));
            index++;
        }

        return savedList;
    }

    @Transactional
    public List<ClassActivityEntity> initializeActivitiesFromH2(Long classId) {
        List<ClassActivityEntity> existing = activityRepository.findByClassIdOrderByIdDesc(classId);
        if (!existing.isEmpty()) {
            return existing;
        }

        TrainingClass tc = trainingClassRepository.findById(classId).orElse(null);
        String classCode = tc != null && tc.getCode() != null ? tc.getCode() : "CLASS_" + classId;
        String trainer = tc != null && tc.getMasterTrainer() != null ? tc.getMasterTrainer() : "Trainer";
        String admin = tc != null && tc.getClassAdmin() != null ? tc.getClassAdmin() : "ClassAdmin";
        String location = tc != null && tc.getLocation() != null ? tc.getLocation() : "Training Lab";
        long sessionCount = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .count();

        LocalDateTime baseTime = tc != null && tc.getStartDate() != null
                ? tc.getStartDate().atTime(9, 0)
                : LocalDateTime.now().minusDays(3);

        List<ClassActivityEntity> list = new ArrayList<>();
        list.add(ClassActivityEntity.builder()
                .classId(classId)
                .author(admin)
                .initials(buildInitials(admin))
                .content("initialized class " + classCode + " at " + location + " in H2 database.")
                .timestamp(baseTime.format(ACTIVITY_TS_FMT))
                .type("history")
                .build());

        list.add(ClassActivityEntity.builder()
                .classId(classId)
                .author(trainer)
                .initials(buildInitials(trainer))
                .content("synchronized " + sessionCount + " training sessions and milestone weights from H2 schedule.")
                .timestamp(baseTime.plusHours(2).format(ACTIVITY_TS_FMT))
                .type("history")
                .build());

        list.add(ClassActivityEntity.builder()
                .classId(classId)
                .author(trainer)
                .initials(buildInitials(trainer))
                .content("Class " + classCode + " curriculum and topic assessments are ready for review.")
                .timestamp(baseTime.plusDays(1).format(ACTIVITY_TS_FMT))
                .type("comment")
                .build());

        List<ClassActivityEntity> saved = activityRepository.saveAll(list);
        Collections.reverse(saved);
        return saved;
    }

    // =========================================================================
    // MAPPING & STRING HELPERS
    // =========================================================================

    private String extractTopicCode(String text) {
        if (text == null || text.isBlank()) return "";
        String cleaned = text.replaceFirst("^\\d+\\.\\s*", "").trim();
        int open = cleaned.indexOf('[');
        int close = cleaned.indexOf(']');
        if (open >= 0 && close > open + 1) {
            return cleaned.substring(open + 1, close).trim();
        }
        int dash = cleaned.indexOf(" - ");
        if (dash > 0) {
            return cleaned.substring(0, dash).trim();
        }
        return cleaned;
    }

    private String formatTopicDisplayNameFromSession(String code, String sessionTitle) {
        return switch (code) {
            case "JAVA_CORE" -> "[JAVA_CORE] Java Core & OOP Fundamentals (1.0)";
            case "SPRING_BOOT" -> "[SPRING_BOOT] Enterprise Backend Development with Spring Boot (1.0)";
            case "DATABASE_SQL" -> "[DATABASE_SQL] Relational Database Design & SQL Optimization (1.0)";
            case "REACT_FRONTEND" -> "[REACT_FRONTEND] Modern Frontend Development with React & TypeScript (1.0)";
            case "DEVOPS_BASIC" -> "[DEVOPS_BASIC] Docker Containerization & CI/CD DevOps Basics (1.0)";
            default -> sessionTitle != null && !sessionTitle.isBlank() ? sessionTitle : "[" + code + "] " + code;
        };
    }

    private String resolveDefaultActor(Long classId) {
        return trainingClassRepository.findById(classId)
                .map(TrainingClass::getClassAdmin)
                .filter(a -> a != null && !a.isBlank())
                .orElse("ClassAdmin");
    }

    private String buildInitials(String author) {
        if (author == null || author.isBlank()) return "CA";
        String cleaned = author.trim();
        String[] parts = cleaned.split("\\s+");
        if (parts.length >= 2) {
            return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase(Locale.ROOT);
        }
        return cleaned.length() >= 2 ? cleaned.substring(0, 2).toUpperCase(Locale.ROOT) : cleaned.toUpperCase(Locale.ROOT);
    }

    private Map<String, Object> toOperationMap(ClassOperationEntity entity) {
        Map<String, Object> res = new HashMap<>();
        res.put("classId", entity.getClassId());

        Map<String, Object> opInfo = new HashMap<>();
        opInfo.put("actualStartDate", entity.getActualStartDate() != null ? entity.getActualStartDate() : "");
        opInfo.put("earlyGraduatedDate", entity.getEarlyGraduatedDate() != null ? entity.getEarlyGraduatedDate() : "");
        opInfo.put("actualEndDate", entity.getActualEndDate() != null ? entity.getActualEndDate() : "");
        opInfo.put("hasNoAllocationNeeds", Boolean.TRUE.equals(entity.getHasNoAllocationNeeds()));

        Map<String, Object> gpa = new HashMap<>();
        gpa.put("topicMark", entity.getTopicMark() != null ? entity.getTopicMark() : 70);
        gpa.put("disciplinePoint", entity.getDisciplinePoint() != null ? entity.getDisciplinePoint() : 30);
        gpa.put("bonusPoint", entity.getBonusPoint() != null ? entity.getBonusPoint() : 10);
        gpa.put("penaltyPoint", entity.getPenaltyPoint() != null ? entity.getPenaltyPoint() : 20);
        opInfo.put("gpaCalculation", gpa);

        res.put("operatingInfo", opInfo);

        List<Object> milestones = new ArrayList<>();
        if (entity.getMilestonesJson() != null && !entity.getMilestonesJson().isBlank()) {
            try {
                milestones = objectMapper.readValue(entity.getMilestonesJson(), new TypeReference<List<Object>>() {});
            } catch (Exception e) {
                log.error("Failed to parse milestonesJson", e);
            }
        }
        res.put("milestones", milestones);
        res.put("totalWeightedNumber", entity.getTotalWeightedNumber() != null ? entity.getTotalWeightedNumber() : 0);

        return res;
    }

    private Map<String, Object> toTopicMap(ClassTopicAssessmentEntity entity) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", entity.getTopicIndex() != null ? entity.getTopicIndex() : entity.getId());
        map.put("title", entity.getTitle());

        List<Object> assessments = new ArrayList<>();
        if (entity.getAssessmentsJson() != null && !entity.getAssessmentsJson().isBlank()) {
            try {
                assessments = objectMapper.readValue(entity.getAssessmentsJson(), new TypeReference<List<Object>>() {});
            } catch (Exception e) {
                log.error("Failed to parse assessmentsJson", e);
            }
        }
        map.put("assessments", assessments);
        return map;
    }
}
