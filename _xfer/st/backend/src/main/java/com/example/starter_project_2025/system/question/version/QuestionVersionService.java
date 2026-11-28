package com.example.starter_project_2025.system.question.version;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** History of question-bank questions: records every save, lists, compares. Exam-scoped copies are not tracked. */
@Service
@RequiredArgsConstructor
public class QuestionVersionService {

    private final QuestionVersionRepository repository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    static boolean isTracked(Question q) {
        return q != null && q.getId() != null && q.getSourceQuestionId() == null && q.getExamId() == null
                && !"AI_GENERATED".equalsIgnoreCase(q.getSource());
    }

    /** Called before the first edit so questions that existed before this feature still get a v1 to go back to. */
    @Transactional
    public void ensureBaseline(Question q) {
        if (isTracked(q) && !repository.existsByQuestionId(q.getId())) {
            record(q, "Initial version");
        }
    }

    @Transactional
    public void record(Question q, String note) {
        if (!isTracked(q)) {
            return;
        }
        QuestionVersion v = new QuestionVersion();
        v.setQuestionId(q.getId());
        v.setVersionNumber(repository.maxVersion(q.getId()) + 1);
        v.setSnapshot(write(snapshotOf(q)));
        v.setNote(note);
        v.setCreatedBy(currentUserId());
        v.setCreatedAt(Instant.now());
        repository.save(v);
    }

    @Transactional(readOnly = true)
    public List<QuestionVersionDTO> history(Long questionId) {
        requireBankQuestion(questionId);
        List<QuestionVersion> rows = repository.findAllByQuestionIdOrderByVersionNumberDesc(questionId);
        Map<Long, String> names = names(rows);
        return rows.stream().map(v -> toDto(v, names)).toList();
    }

    @Transactional(readOnly = true)
    public QuestionVersionDTO get(Long questionId, int versionNumber) {
        requireBankQuestion(questionId);
        QuestionVersion v = find(questionId, versionNumber);
        return toDto(v, names(List.of(v)));
    }

    @Transactional(readOnly = true)
    public QuestionVersionCompareDTO compare(Long questionId, int from, int to) {
        requireBankQuestion(questionId);
        if (from == to) {
            throw new BadRequestException("Choose two different versions to compare");
        }
        QuestionSnapshot a = read(find(questionId, from).getSnapshot());
        QuestionSnapshot b = read(find(questionId, to).getSnapshot());
        return new QuestionVersionCompareDTO(from, to, diff(a, b));
    }

    /** Snapshot of a stored version, for restoring. */
    @Transactional(readOnly = true)
    public QuestionSnapshot snapshot(Long questionId, int versionNumber) {
        requireBankQuestion(questionId);
        return read(find(questionId, versionNumber).getSnapshot());
    }

    /** Replaces the note of the newest version (used to mark a restore). */
    @Transactional
    public void labelLatest(Long questionId, String note) {
        int latest = repository.maxVersion(questionId);
        repository.findByQuestionIdAndVersionNumber(questionId, latest).ifPresent(v -> {
            v.setNote(note);
            repository.save(v);
        });
    }

    @Transactional
    public void deleteHistory(Long questionId) {
        repository.deleteAllByQuestionId(questionId);
    }

    static List<QuestionVersionCompareDTO.FieldChange> diff(QuestionSnapshot a, QuestionSnapshot b) {
        List<QuestionVersionCompareDTO.FieldChange> out = new ArrayList<>();
        add(out, "Content", a.content(), b.content());
        add(out, "Type", a.type(), b.type());
        add(out, "Difficulty", a.difficulty(), b.difficulty());
        add(out, "Topic", a.topic(), b.topic());
        add(out, "Points", String.valueOf(a.points()), String.valueOf(b.points()));
        add(out, "Image URL", a.imageUrl(), b.imageUrl());
        add(out, "Answer options", options(a), options(b));
        add(out, "Grading criteria", criteria(a), criteria(b));
        add(out, "Code spec", a.codeSpec(), b.codeSpec());
        return out;
    }

    private static void add(List<QuestionVersionCompareDTO.FieldChange> out, String field, String before, String after) {
        String x = before == null ? "" : before;
        String y = after == null ? "" : after;
        if (!x.equals(y)) {
            out.add(new QuestionVersionCompareDTO.FieldChange(field, x, y));
        }
    }

    private static String options(QuestionSnapshot s) {
        if (s.options() == null) {
            return "";
        }
        return s.options().stream().map(o -> (o.correct() ? "[x] " : "[ ] ") + o.content())
                .collect(Collectors.joining("\n"));
    }

    private static String criteria(QuestionSnapshot s) {
        if (s.gradingCriteria() == null) {
            return "";
        }
        return s.gradingCriteria().stream()
                .map(c -> c.name() + " (" + c.weightPercentage() + "%)"
                        + (c.description() == null || c.description().isBlank() ? "" : ": " + c.description()))
                .collect(Collectors.joining("\n"));
    }

    static QuestionSnapshot snapshotOf(Question q) {
        List<QuestionSnapshot.Option> options = q.getOptions().stream()
                .map(o -> new QuestionSnapshot.Option(o.getId(), o.getContent(), o.isCorrect(), o.getImageUrl()))
                .toList();
        List<QuestionSnapshot.Criterion> criteria = q.getGradingCriteria().stream()
                .map(c -> new QuestionSnapshot.Criterion(c.getName(), c.getDescription(), c.getWeightPercentage()))
                .toList();
        return new QuestionSnapshot(q.getContent(), q.getType() == null ? null : q.getType().name(),
                q.getDifficulty() == null ? null : q.getDifficulty().name(), q.getTopic(), q.getImageUrl(),
                q.getPoints(), q.getCodeSpec(), options, criteria);
    }

    private void requireBankQuestion(Long questionId) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Question not found"));
        if (!isTracked(q)) {
            throw new ResourceNotFoundException("Question not found");
        }
    }

    private QuestionVersion find(Long questionId, int versionNumber) {
        return repository.findByQuestionIdAndVersionNumber(questionId, versionNumber)
                .orElseThrow(() -> new ResourceNotFoundException("Version not found"));
    }

    private QuestionVersionDTO toDto(QuestionVersion v, Map<Long, String> names) {
        return new QuestionVersionDTO(v.getId(), v.getVersionNumber(), v.getNote(), v.getCreatedBy(),
                v.getCreatedBy() == null ? null : names.get(v.getCreatedBy()), v.getCreatedAt(), read(v.getSnapshot()));
    }

    private Map<Long, String> names(List<QuestionVersion> rows) {
        List<Long> ids = rows.stream().map(QuestionVersion::getCreatedBy).filter(Objects::nonNull).distinct().toList();
        Map<Long, String> map = new HashMap<>();
        if (!ids.isEmpty()) {
            for (User u : userRepository.findAllById(ids)) {
                String name = ((u.getFirstName() == null ? "" : u.getFirstName().trim()) + " "
                        + (u.getLastName() == null ? "" : u.getLastName().trim())).trim();
                map.put(u.getId(), name.isEmpty() ? u.getEmail() : name);
            }
        }
        return map;
    }

    private static Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UserPrincipal p && p.getUser() != null) {
            return p.getUser().getId();
        }
        return null;
    }

    private String write(QuestionSnapshot s) {
        try {
            return objectMapper.writeValueAsString(s);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize question snapshot", e);
        }
    }

    private QuestionSnapshot read(String json) {
        try {
            return objectMapper.readValue(json, QuestionSnapshot.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot read question snapshot", e);
        }
    }
}
