package com.example.starter_project_2025.system.project.task.audit;

import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TaskAuditService {
    private final TaskAuditRepository auditRepository;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action, TaskDTO before, TaskDTO after, Long actorId, String correlationId) {
        auditRepository.save(TaskAuditLog.builder()
                .taskId(after.getId()).projectId(after.getProjectId()).actorId(actorId)
                .action(action).beforeState(before == null ? null : toJson(before))
                .afterState(toJson(after)).correlationId(correlationId).build());
    }

    private String toJson(TaskDTO value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Không thể lưu audit của Task", ex);
        }
    }
}
