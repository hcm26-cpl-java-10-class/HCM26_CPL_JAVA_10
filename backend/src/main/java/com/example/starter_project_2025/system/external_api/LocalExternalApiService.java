package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.exception.ConflictException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Standalone development data; never used as a fallback for a failed remote API. */
@Service
@Profile("local")
public class LocalExternalApiService implements ExternalApiService {
    private final ConcurrentHashMap<Long, ExternalClassDTO> classes = new ConcurrentHashMap<>();
    private static final String TRAINER_NOTE_PREFIX = "Trainer: ";
    private final AtomicLong classIds = new AtomicLong(3);

    @Autowired(required = false)
    private SessionRepository sessionRepository;

    public LocalExternalApiService() {
        classes.put(1L, ExternalClassDTO.builder().id(1L).code("LOCAL_JAVA_01").name("Lớp Chuyên sâu Java Backend (K26)")
                .startDate("2026-10-01").endDate("2027-01-31").status("active")
                .plannedSize(25).enrolledCount(18)
                .deliveryType("Class").traineeType("Fresher").formatType("Offline").skills("Java, Spring Boot")
                .site("TP. Hồ Chí Minh").location("F-Town 3, Phòng Lab 201").subjectType("IT Technical")
                .scope("Unit").supplierPartner("SCM").jobRecommendation(false).build());
        classes.put(2L, ExternalClassDTO.builder().id(2L).code("LOCAL_JAVA_02").name("Lớp Lập trình Fullstack Java Web (K26)")
                .startDate("2026-11-15").endDate("2027-03-15").status("active")
                .plannedSize(30).enrolledCount(0)
                .deliveryType("Class").traineeType("Fresher").formatType("Hybrid").skills("Java, React")
                .site("TP. Hồ Chí Minh").location("QTSC 9, Phòng 304").subjectType("IT Technical")
                .scope("Unit").supplierPartner("SCM").jobRecommendation(false).build());
        classes.put(3L, ExternalClassDTO.builder().id(3L).code("LOCAL_JAVA_OLD").name("Lớp Kỹ thuật phần mềm Java (Đã hoàn thành)")
                .startDate("2026-03-01").endDate("2026-07-31").status("inactive")
                .plannedSize(25).enrolledCount(24)
                .deliveryType("Class").traineeType("Fresher").formatType("Offline").skills("Java")
                .site("Hà Nội").location("F-Ville 2, Phòng Lab 405").subjectType("IT Technical")
                .scope("Unit").supplierPartner("SCM").jobRecommendation(false).build());
    }

    @Override
    public boolean isSampleData() {
        return true;
    }

    @Override
    public List<ExternalClassDTO> fetchClasses(String status) {
        return new ArrayList<>(classes.values()).stream().sorted(Comparator.comparing(ExternalClassDTO::getId))
                .filter(item -> matchesStatus(status, item.getStatus())).toList();
    }

    @Override
    public ExternalClassDTO fetchClassById(Long id) {
        ExternalClassDTO classData = classes.get(id);
        if (classData == null) throw new ExternalApiException("Sample class not found: " + id, 404, null);
        return classData;
    }

    @Override
    public synchronized ExternalClassDTO createClass(ExternalClassRequest request) {
        ensureUniqueCode(request.code(), null);
        long id = classIds.incrementAndGet();
        ExternalClassDTO classData = toClass(id, request, null, 0);
        classes.put(id, classData);
        return classData;
    }

    @Override
    public synchronized ExternalClassDTO updateClass(Long id, ExternalClassRequest request) {
        ExternalClassDTO current = fetchClassById(id);
        ensureUniqueCode(request.code(), id);
        ExternalClassDTO updated = toClass(id, request, current.getProgramId(),
                current.getEnrolledCount() == null ? 0 : current.getEnrolledCount());
        classes.put(id, updated);
        return updated;
    }

    @Override
    public synchronized void deleteClass(Long id) {
        if (classes.remove(id) == null) throw new ExternalApiException("Sample class not found: " + id, 404, null);
    }

    @Override
    public List<ExternalTrainerDTO> fetchTrainers(String status) {
        return trainerDirectory().stream().filter(item -> matchesStatus(status, item.getStatus())).toList();
    }

    private List<ExternalTrainerDTO> trainerDirectory() {
        return List.of(
                new ExternalTrainerDTO(1L, "Nguyễn Ngọc Tân (Trainer)", "trainer.tan@example.com", "active"),
                new ExternalTrainerDTO(2L, "Nguyễn Mạnh Hoàng (Trainer)", "trainer.hoang@example.com", "active"),
                new ExternalTrainerDTO(3L, "Nguyễn Văn Thắng (Trainer)", "trainer.thang@example.com", "active"),
                new ExternalTrainerDTO(4L, "Nguyễn Tuấn Danh (Trainer)", "trainer.danh@example.com", "active"),
                new ExternalTrainerDTO(5L, "Huỳnh Tấn Phát (Trainer)", "trainer.phat@example.com", "active")
        );
    }

    private Long trainerIdByName(String name) {
        if (name == null || name.isBlank()) return null;
        return trainerDirectory().stream().filter(t -> name.trim().equalsIgnoreCase(t.getName())).map(ExternalTrainerDTO::getId).findFirst().orElse(null);
    }

    private String trainerNameById(Long id) {
        if (id == null) return "";
        return trainerDirectory().stream().filter(t -> id.equals(t.getId())).map(ExternalTrainerDTO::getName).findFirst().orElse(String.valueOf(id));
    }

    @Override
    public List<ExternalRoomDTO> fetchRooms() {
        return List.of(
                new ExternalRoomDTO(1L, "Phòng Lab 201 (F-Town 2)", 30),
                new ExternalRoomDTO(2L, "Phòng 304 (Innovation Hall)", 25),
                new ExternalRoomDTO(3L, "Phòng Lab 405 (F-Town 1)", 30),
                new ExternalRoomDTO(4L, "Phòng Online Zoom A", 100),
                new ExternalRoomDTO(5L, "Online MS Teams", 100),
                new ExternalRoomDTO(6L, "Room A101", 30)
        );
    }

    @Override
    public Object fetchClassSessions(Long classId) {
        if (sessionRepository == null) return List.of();
        return sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .map(this::toSessionMap)
                .toList();
    }

    @Override
    public Object createClassSession(Long classId, Object body) {
        if (sessionRepository == null || !(body instanceof Map<?, ?> map)) return Map.of();
        Session session = new Session();
        session.setClassId(classId);
        session.setIsActive(true);
        applySessionFields(session, map);
        Session saved = sessionRepository.save(session);
        return toSessionMap(saved);
    }

    @Override
    public Object updateClassSession(Long classId, Long sessionId, Object body) {
        if (sessionRepository == null || !(body instanceof Map<?, ?> map)) return Map.of();
        Session session = sessionRepository.findById(sessionId).orElse(null);
        if (session == null) {
            return createClassSession(classId, body);
        }
        applySessionFields(session, map);
        Session saved = sessionRepository.save(session);
        return toSessionMap(saved);
    }

    @Override
    public void deleteClassSession(Long classId, Long sessionId) {
        if (sessionRepository != null) {
            sessionRepository.findById(sessionId).ifPresent(s -> {
                s.setIsActive(false);
                sessionRepository.save(s);
            });
        }
    }

    private void applySessionFields(Session session, Map<?, ?> map) {
        String topic = map.get("topic") != null ? map.get("topic").toString() : "Session";
        session.setTitle(topic.length() > 150 ? topic.substring(0, 150) : topic);

        session.setTopicId(1L);
        session.setTrainerId(1L);
        if (map.get("trainerId") instanceof Number n) {
            session.setTrainerId(n.longValue());
        } else if (map.get("trainer") != null) {
            Long byName = trainerIdByName(map.get("trainer").toString());
            if (byName != null) {
                session.setTrainerId(byName);
                if (session.getNote() != null && session.getNote().startsWith(TRAINER_NOTE_PREFIX)) session.setNote(null);
            } else if (!map.get("trainer").toString().isBlank() && map.get("notes") == null) {
                // Trainer is not in the local directory (e.g. the class master trainer): keep the name so it round-trips.
                session.setNote(TRAINER_NOTE_PREFIX + map.get("trainer").toString().trim());
            }
        }

        String location = map.get("room") != null ? map.get("room").toString() : (map.get("venue") != null ? map.get("venue").toString() : "Room A101");
        session.setLocation(location.length() > 150 ? location.substring(0, 150) : location);

        session.setStatus(Session.SessionStatus.SCHEDULED);
        if (map.get("notes") != null) {
            session.setNote(map.get("notes").toString());
        }

        String dateStr = map.get("date") != null ? map.get("date").toString() : null;
        String slotStr = map.get("slot") != null ? map.get("slot").toString() : null;

        LocalDate date = LocalDate.now();
        if (dateStr != null && !dateStr.isBlank()) {
            try { date = LocalDate.parse(dateStr.trim()); } catch (Exception ignored) {}
        }

        LocalTime startTime = LocalTime.of(8, 0);
        LocalTime endTime = LocalTime.of(12, 0);

        if (slotStr != null && !slotStr.isBlank()) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d{1,2}:\\d{2})").matcher(slotStr);
            if (m.find()) {
                try {
                    String[] parts = m.group(1).split(":");
                    startTime = LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
                } catch (Exception ignored) {}
                if (m.find()) {
                    try {
                        String[] parts = m.group(1).split(":");
                        endTime = LocalTime.of(Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
                    } catch (Exception ignored) {}
                } else {
                    endTime = startTime.plusHours(4);
                }
            }
        }
        if (!endTime.isAfter(startTime)) {
            endTime = startTime.plusHours(2);
        }

        session.setStartTime(LocalDateTime.of(date, startTime));
        session.setEndTime(LocalDateTime.of(date, endTime));
    }

    private Map<String, Object> toSessionMap(Session s) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", s.getId());
        map.put("classId", s.getClassId());
        map.put("date", s.getStartTime() != null ? s.getStartTime().toLocalDate().toString() : "");
        map.put("slot", (s.getStartTime() != null ? s.getStartTime().toLocalTime() : "") + " - " + (s.getEndTime() != null ? s.getEndTime().toLocalTime() : ""));
        map.put("topic", s.getTitle());
        map.put("topicCode", s.getTitle() != null && s.getTitle().startsWith("[") && s.getTitle().contains("]") ? s.getTitle().substring(1, s.getTitle().indexOf("]")) : "");
        boolean noteIsTrainer = s.getNote() != null && s.getNote().startsWith(TRAINER_NOTE_PREFIX);
        map.put("trainer", noteIsTrainer ? s.getNote().substring(TRAINER_NOTE_PREFIX.length()) : trainerNameById(s.getTrainerId()));
        map.put("room", s.getLocation() != null ? s.getLocation() : "Room A101");
        map.put("status", s.getStatus() != null ? s.getStatus().name().toLowerCase() : "scheduled");
        map.put("type", "lecture");
        map.put("notes", s.getNote() != null && s.getNote().startsWith(TRAINER_NOTE_PREFIX) ? "" : s.getNote());
        return map;
    }

    private ExternalClassDTO toClass(Long id, ExternalClassRequest request, Long programId, Integer enrolledCount) {
        return ExternalClassDTO.builder().id(id).code(request.code().trim()).name(request.name().trim())
                .programId(programId).startDate(blankToNull(request.startDate())).endDate(blankToNull(request.endDate()))
                .status(request.status().toLowerCase(Locale.ROOT)).plannedSize(request.plannedSize())
                .enrolledCount(enrolledCount)
                .deliveryType(request.deliveryType()).traineeType(request.traineeType())
                .formatType(request.formatType()).skills(request.skills()).site(request.site())
                .location(request.location()).subjectType(request.subjectType()).scope(request.scope())
                .supplierPartner(request.supplierPartner()).keyProgram(request.keyProgram())
                .jobRecommendation(request.jobRecommendation()).build();
    }

    private void ensureUniqueCode(String code, Long ignoredId) {
        boolean duplicate = classes.values().stream().anyMatch(item -> !Objects.equals(item.getId(), ignoredId)
                && item.getCode().equalsIgnoreCase(code.trim()));
        if (duplicate) throw new ConflictException("Mã lớp đã tồn tại: " + code.trim());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private boolean matchesStatus(String requested, String actual) {
        return requested == null || requested.isBlank() || requested.equalsIgnoreCase(actual);
    }
}
