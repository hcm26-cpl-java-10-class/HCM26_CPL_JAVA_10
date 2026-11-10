package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.training.entity.*;
import com.example.starter_project_2025.system.demo.session.*;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.*;
import java.util.*;

/** Calendars belong to internal classes. ID zero is the current, read-only session schedule. */
@Service @RequiredArgsConstructor
public class TrainingCalendarService {
    private final TrainingClassRepository classes;
    private final TrainingCalendarRepository calendars;
    private final SessionRepository sessions;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public List<ObjectNode> list(Long classId) {
        var cls = requireClass(classId);
        var result = new ArrayList<ObjectNode>();
        var live = sessions.findByClassId(classId).stream()
            .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && s.getStatus() != Session.SessionStatus.CANCELLED)
            .sorted(Comparator.comparing(Session::getStartTime).thenComparing(Session::getId)).toList();
        {
            var node = mapper.createObjectNode();
            node.put("id", 0).put("classId", classId).put("name", cls.getCode() + "_Calendar")
                .put("version", "Live").put("status", "active").put("historyChange", "Synchronized from Class Info")
                .put("classStartDate", cls.getStartDate().toString())
                .put("classEndDate", cls.getEndDate().toString())
                .put("actualLearningStartDate", live.isEmpty() ? "" : live.getFirst().getStartTime().toLocalDate().toString());
            var latest = java.util.stream.Stream.concat(java.util.stream.Stream.of(cls.getUpdatedAt()), live.stream().map(Session::getUpdatedAt))
                .filter(Objects::nonNull).max(Comparator.naturalOrder()).orElse(null);
            node.put("lastModifiedDate", latest == null ? "" : latest.toString());
            node.put("lastModifiedBy", "");
            var topics = node.putArray("overviewItems");
            for (var s : live) {
                var topic = topics.addObject();
                topic.put("id", "session-" + s.getId()).put("label", s.getTitle()).put("name", s.getTitle())
                    .put("startDate", s.getStartTime().toLocalDate().toString()).put("endDate", s.getEndTime().toLocalDate().toString());
                var lesson = topic.putArray("lessons").addObject();
                lesson.put("id", "session-" + s.getId()).put("name", s.getTitle())
                    .put("from", s.getStartTime().toLocalDate().toString()).put("to", s.getEndTime().toLocalDate().toString())
                    .put("slot", s.getStartTime().toLocalTime() + "-" + s.getEndTime().toLocalTime())
                    .put("venue", s.getLocation()).put("notes", s.getNote());
            }
            result.add(node);
        }
        calendars.findByClassIdOrderByRevisionDesc(classId).forEach(c -> result.add(view(c, cls)));
        return result;
    }

    @Transactional
    public ObjectNode create(Long classId, Long sourceId, JsonNode body) {
        var cls = classes.findForUpdate(classId).filter(c -> Boolean.TRUE.equals(c.getIsActive()))
            .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (sourceId != null && sourceId != 0) owned(classId, sourceId);
        if (sourceId != null && sourceId == 0 && list(classId).stream().noneMatch(n -> n.path("id").asLong() == 0))
            throw new ResourceNotFoundException("Current session calendar not found");
        validate(body, cls);
        var existing = calendars.findByClassIdOrderByRevisionDesc(classId);
        int revision = existing.isEmpty() ? 1 : existing.getFirst().getRevision() + 1;
        var entity = new TrainingCalendar();
        entity.setClassId(classId); entity.setRevision(revision);
        entity.setName(cls.getCode() + "_Calendar_" + revision);
        entity.setHistoryChange(sourceId == null ? "Initial training calendar" : "Adjusted calendar version");
        entity.setModifiedBy(actor());
        entity.setClassStartDate(cls.getStartDate());
        entity.setActualLearningStartDate(date(body, "actualLearningStartDate"));
        entity.setTopicsJson(body.get("overviewItems").toString());
        var schedule = mapper.createObjectNode();
        schedule.set("overviewItems", body.get("overviewItems"));
        schedule.set("actualLearningStartDate", body.get("actualLearningStartDate"));
        entity.setSchedule(schedule.toString());
        return view(calendars.saveAndFlush(entity), cls);
    }

    @Transactional
    public void update(Long classId, JsonNode body) {
        requireClass(classId);
        if (!body.path("updates").isArray()) throw new BadRequestException("Calendar updates are required");
        for (var update : body.path("updates")) {
            if (!update.path("id").isIntegralNumber()) throw new BadRequestException("Calendar ID is required");
            var entity = owned(classId, update.path("id").asLong());
            String name = text(update, "name", 100), note = text(update, "historyChange", 200);
            entity.setName(name); entity.setHistoryChange(note); entity.setModifiedBy(actor());
            calendars.save(entity);
        }
    }

    private ObjectNode view(TrainingCalendar c, TrainingClass cls) {
        try {
            var node = c.getSchedule() == null || c.getSchedule().isBlank()
                ? mapper.createObjectNode() : (ObjectNode) mapper.readTree(c.getSchedule());
            if (!node.has("overviewItems")) node.set("overviewItems", mapper.readTree(c.getTopicsJson()));
            if (!node.has("actualLearningStartDate")) node.put("actualLearningStartDate", c.getActualLearningStartDate().toString());
            node.put("id", c.getId()).put("classId", c.getClassId()).put("name", c.getName())
                .put("version", "1." + (c.getRevision() - 1)).put("status", "draft").put("historyChange", c.getHistoryChange())
                .put("classStartDate", cls.getStartDate().toString()).put("lastModifiedBy", c.getModifiedBy() == null || c.getModifiedBy().isBlank() ? c.getLastModifiedBy() : c.getModifiedBy())
                .put("lastModifiedDate", c.getUpdatedAt() == null ? "" : c.getUpdatedAt().toString());
            return node;
        } catch (java.io.IOException e) { throw new IllegalStateException("Stored calendar is invalid", e); }
    }
    private TrainingClass requireClass(Long id) {
        return classes.findByIdAndIsActiveTrue(id).orElseThrow(() -> new ResourceNotFoundException("Class not found"));
    }
    private TrainingCalendar owned(Long classId, Long id) {
        return calendars.findById(id).filter(c -> c.getClassId().equals(classId))
            .orElseThrow(() -> new ResourceNotFoundException("Calendar version not found for this class"));
    }
    private String actor() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "" : auth.getName();
    }
    private String text(JsonNode n, String field, int max) {
        var value = n.path(field);
        if (!value.isTextual() || value.asText().isBlank() || value.asText().length() > max)
            throw new BadRequestException(field + " is required and must be at most " + max + " characters");
        return value.asText().trim();
    }
    private LocalDate date(JsonNode n, String field) {
        try { return LocalDate.parse(n.path(field).asText()); }
        catch (RuntimeException e) { throw new BadRequestException("Invalid " + field); }
    }
    private void validate(JsonNode body, TrainingClass cls) {
        if (!date(body, "classStartDate").equals(cls.getStartDate()))
            throw new BadRequestException("Class Start Date must match Class Info. Refresh and try again.");
        var learning = date(body, "actualLearningStartDate");
        if (learning.isBefore(cls.getStartDate()) || learning.isAfter(cls.getEndDate()))
            throw new BadRequestException("Learning start must be within the class date range");
        var topics = body.path("overviewItems");
        if (!topics.isArray() || topics.isEmpty()) throw new BadRequestException("Add at least one topic");
        var ids = new HashSet<String>();
        for (var topic : topics) {
            if (!ids.add(text(topic, "id", 100))) throw new BadRequestException("Duplicate topic ID");
            text(topic, "label", 100);
            var start = date(topic, "startDate"); var end = date(topic, "endDate");
            if (start.isBefore(learning) || end.isBefore(start) || end.isAfter(cls.getEndDate()))
                throw new BadRequestException("Topic dates must be within the learning and class date range");
            if (topic.has("lessons") && !topic.path("lessons").isArray()) throw new BadRequestException("Invalid lessons");
            for (var lesson : topic.path("lessons")) {
                text(lesson, "id", 100); text(lesson, "name", 255);
                var from = date(lesson, "from"); var to = date(lesson, "to");
                if (from.isBefore(start) || to.isAfter(end) || to.isBefore(from))
                    throw new BadRequestException("Lesson dates must be within the topic date range");
            }
        }
    }
}
