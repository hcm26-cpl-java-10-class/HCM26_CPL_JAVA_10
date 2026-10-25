package com.example.starter_project_2025.system.project.task.audit;

import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskAuditService {
    private final TaskAuditRepository auditRepository;
    private final ObjectMapper objectMapper;
    private final UserRepository userRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action, TaskDTO before, TaskDTO after, Long actorId, String correlationId) {
        auditRepository.save(TaskAuditLog.builder()
                .taskId(after.getId()).projectId(after.getProjectId()).actorId(actorId)
                .action(action).beforeState(before == null ? null : toJson(before))
                .afterState(toJson(after)).correlationId(correlationId).build());
    }

    @Transactional(readOnly = true)
    public List<TaskActivityDTO> getActivity(UUID taskId) {
        List<TaskAuditLog> logs = auditRepository.findByTaskIdOrderByOccurredAtAsc(taskId);
        Map<Long, User> actors = userRepository.findAllById(logs.stream().map(TaskAuditLog::getActorId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        return logs.stream().map(log -> new TaskActivityDTO(log.getId(), log.getAction(), log.getActorId(),
                actorName(actors.get(log.getActorId())), log.getOccurredAt(),
                fromJson(log.getBeforeState()), fromJson(log.getAfterState()))).toList();
    }

    private String actorName(User actor) {
        if (actor == null) return "Member";
        return ((actor.getFirstName() == null ? "" : actor.getFirstName()) + " "
                + (actor.getLastName() == null ? "" : actor.getLastName())).strip();
    }

    private TaskDTO fromJson(String json) {
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, TaskDTO.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to read task history", ex);
        }
    }

    private String toJson(TaskDTO value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to save task audit log", ex);
        }
    }
}
