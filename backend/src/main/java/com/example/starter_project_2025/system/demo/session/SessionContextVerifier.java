package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * Re-validates, on the server, that the class and trainer a session points at really exist in the
 * master training system. Sessions only store their ids, so nothing else guards them.
 * If the master system cannot be reached the {@link ExternalApiException} is propagated on purpose:
 * an unverifiable session must not be written.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionContextVerifier {

    private static final String ACTIVE = "active";

    ExternalApiService externalApiService;

    /**
     * Remembers what was already asked, so a bulk operation (a file import) calls the master system once per
     * class and once for the trainer list instead of once per row. Use one instance per operation, never share it.
     */
    public static final class Memo {
        private final Map<Long, Boolean> classExists = new HashMap<>();
        private Set<Long> activeTrainerIds;
    }

    public void verifyClass(Long classId, ValidationContext ctx) {
        verifyClass(classId, ctx, new Memo());
    }

    public void verifyClass(Long classId, ValidationContext ctx, Memo memo) {
        if (classId == null) {
            return;
        }
        Boolean exists = memo.classExists.get(classId);
        if (exists == null) {
            exists = classExistsInMasterSystem(classId);
            memo.classExists.put(classId, exists);
        }
        if (!exists) {
            ctx.add("classId", "Class #" + classId + " does not exist in the master training system");
        }
    }

    public void verifyTrainer(Long trainerId, ValidationContext ctx) {
        verifyTrainer(trainerId, ctx, new Memo());
    }

    public void verifyTrainer(Long trainerId, ValidationContext ctx, Memo memo) {
        if (trainerId == null) {
            return;
        }
        if (memo.activeTrainerIds == null) {
            Set<Long> ids = new HashSet<>();
            for (ExternalTrainerDTO trainer : externalApiService.fetchTrainers(ACTIVE)) {
                ids.add(trainer.getId());
            }
            memo.activeTrainerIds = ids;
        }
        if (!memo.activeTrainerIds.contains(trainerId)) {
            ctx.add("trainerId", "Trainer #" + trainerId + " is not an active trainer in the master training system");
        }
    }

    private boolean classExistsInMasterSystem(Long classId) {
        try {
            externalApiService.fetchClassById(classId);
            return true;
        } catch (ExternalApiException ex) {
            if (ex.getStatusCode() == HttpStatus.NOT_FOUND.value()) {
                return false;
            }
            throw ex;
        }
    }
}
