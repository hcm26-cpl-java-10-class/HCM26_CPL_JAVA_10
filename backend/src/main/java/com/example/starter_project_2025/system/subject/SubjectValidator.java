package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import jakarta.validation.groups.Default;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Shared normalization and domain validation rules for Subject/Topic CRUD and bulk imports.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SubjectValidator {

    static final int MAX_DURATION_HOURS = 1000;
    static final Pattern NUMERIC_ONLY = Pattern.compile("^[0-9]+(\\.[0-9]+)?$");

    SubjectRepository subjectRepository;
    Validator beanValidator;

    public void normalizeForCreate(SubjectDTO request) {
        if (request == null) return;
        request.setCode(SubjectIdentity.normalizeCode(request.getCode()));
        request.setVersion(SubjectIdentity.normalizeVersion(request.getVersion()));
        trimOptionalTextFields(request);

        if (request.getIsActive() == null) {
            request.setIsActive(request.getStatus() != SubjectStatus.INACTIVE);
        }
        if (request.getStatus() == null) {
            request.setStatus(Boolean.FALSE.equals(request.getIsActive()) ? SubjectStatus.INACTIVE : SubjectStatus.ACTIVE);
        }
    }

    public void prepareForCreate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        normalizeForCreate(request);
        subject.setCode(request.getCode());
        subject.setVersion(request.getVersion());
        subject.setName(request.getName());
        subject.setDescription(request.getDescription());
        subject.setTechnicalGroup(request.getTechnicalGroup());
        subject.setIsActive(request.getIsActive());
        subject.setStatus(request.getStatus());

        validateIdentity(request.getCode(), request.getVersion(), null, ctx);
        validateBusinessConstraints(request, ctx);
    }

    public void prepareForUpdate(Subject subject, SubjectDTO request, ValidationContext ctx) {
        String resolvedCode = SubjectIdentity.normalizeCode(
                request.getCode() != null ? request.getCode() : subject.getCode());
        String resolvedVersion = SubjectIdentity.normalizeVersion(
                request.getVersion() != null ? request.getVersion() : subject.getVersion());

        validateIdentity(resolvedCode, resolvedVersion, subject.getId(), ctx);
        request.setCode(resolvedCode);
        request.setVersion(resolvedVersion);
        trimOptionalTextFields(request);

        syncStatusForUpdate(subject, request);
        validateBusinessConstraints(request, ctx);
    }

    public List<String> validateDtoConstraints(SubjectDTO dto, boolean skipRequiredDurationError) {
        List<String> errors = new ArrayList<>();
        Set<ConstraintViolation<SubjectDTO>> violations =
                beanValidator.validate(dto, Default.class, OnCreate.class);
        for (ConstraintViolation<SubjectDTO> violation : violations) {
            String property = violation.getPropertyPath().toString();
            if (skipRequiredDurationError && "durationHours".equals(property) && dto.getDurationHours() == null) {
                continue;
            }
            errors.add(violation.getMessage());
        }
        return errors.stream().distinct().toList();
    }

    public Set<String> findExistingIdentityKeys(Collection<SubjectDTO> rows) {
        if (rows == null || rows.isEmpty()) {
            return Set.of();
        }
        Set<String> codes = rows.stream()
                .map(SubjectDTO::getCode)
                .map(SubjectIdentity::normalizeCode)
                .filter(c -> c != null && !c.isBlank())
                .collect(Collectors.toSet());

        if (codes.isEmpty()) {
            return Set.of();
        }

        List<Object[]> pairs = subjectRepository.findIdentityPairsByCodes(codes);
        if (pairs == null || pairs.isEmpty()) {
            return Set.of();
        }

        Set<String> existingKeys = new HashSet<>();
        for (Object[] pair : pairs) {
            if (pair == null || pair.length < 2 || pair[0] == null || pair[1] == null) continue;
            String key = SubjectIdentity.identityKey(pair[0].toString(), pair[1].toString());
            if (key != null) {
                existingKeys.add(key);
            }
        }
        return existingKeys;
    }

    private void validateIdentity(String code, String version, Long excludedId, ValidationContext ctx) {
        if (code == null || code.isBlank()) ctx.add("code", "Subject code is required");
        if (version == null || version.isBlank()) ctx.add("version", "Version is required");
        if (code == null || code.isBlank() || version == null || version.isBlank()) return;

        if (subjectRepository.existsByNormalizedIdentity(code, SubjectIdentity.versionAliases(version), excludedId)) {
            ctx.add("code", "Subject with code '" + code + "' and version '" + version
                    + "' already exists (codes are case-insensitive; v1.0 and 1.0 are the same version)");
        }
    }

    private void validateBusinessConstraints(SubjectDTO request, ValidationContext ctx) {
        if (request.getDurationHours() != null) {
            if (request.getDurationHours() <= 0) {
                ctx.add("durationHours", "Duration must be greater than 0");
            } else if (request.getDurationHours() > MAX_DURATION_HOURS) {
                ctx.add("durationHours", "Duration (Hours) cannot exceed " + MAX_DURATION_HOURS);
            }
        }

        String tg = request.getTechnicalGroup();
        if (tg != null && !tg.isBlank() && NUMERIC_ONLY.matcher(tg.trim()).matches()) {
            ctx.add("technicalGroup", "Technical Group must be text (cannot be only numbers)");
        }
    }

    private void trimOptionalTextFields(SubjectDTO request) {
        if (request.getName() != null) {
            request.setName(request.getName().trim());
        }
        if (request.getDescription() != null) {
            request.setDescription(request.getDescription().trim());
        }
        if (request.getTechnicalGroup() != null) {
            String trimmed = request.getTechnicalGroup().trim();
            request.setTechnicalGroup(trimmed.isEmpty() ? null : trimmed);
        }
    }

    private void syncStatusForUpdate(Subject subject, SubjectDTO request) {
        if (request.getStatus() != null && request.getIsActive() == null) {
            request.setIsActive(request.getStatus() == SubjectStatus.ACTIVE);
        } else if (request.getIsActive() != null && request.getStatus() == null) {
            request.setStatus(request.getIsActive() ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE);
        } else if (request.getStatus() != null && request.getIsActive() != null) {
            request.setIsActive(request.getStatus() == SubjectStatus.ACTIVE && request.getIsActive());
        }
        if (request.getStatus() != null) subject.setStatus(request.getStatus());
        if (request.getIsActive() != null) subject.setIsActive(request.getIsActive());
    }
}

