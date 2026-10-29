package com.example.starter_project_2025.system.audit;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.aop.support.AopUtils;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;

@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    private static final Logger log =
            LoggerFactory.getLogger(AuditLogAspect.class);

    @Around(
            "execution(public * com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl+.create(..))"
    )
    public Object aroundCreate(ProceedingJoinPoint joinPoint) throws Throwable {
        Object result;
        String entityType = getEntityType(joinPoint.getTarget());

        try {
            result = joinPoint.proceed();
        } catch (Throwable ex) {
            if (entityType != null) {
                auditLogService.log(
                        "CREATE",
                        entityType,
                        null,
                        null,
                        null,
                        MDC.get(CorrelationIdFilter.MDC_KEY),
                        "FAILED"
                );
            }
            throw ex;
        }

        if (result instanceof BaseDTO dto && entityType != null) {
            auditLogService.log(
                    "CREATE",
                    entityType,
                    toId(dto.getId()),
                    null,
                    toJson(dto),
                    MDC.get(CorrelationIdFilter.MDC_KEY),
                    "SUCCESS"
            );
        }

        return result;
    }

    @Around(
            "execution(public * com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl+.update(..))"
    )
    public Object aroundUpdate(ProceedingJoinPoint joinPoint) throws Throwable {
        log.info(">>> AuditLogAspect aroundUpdate triggered: {}",
                joinPoint.getSignature());

        Object target = joinPoint.getTarget();
        String entityType = getEntityType(target);

        if (entityType == null) {
            return joinPoint.proceed();
        }

        Object[] args = joinPoint.getArgs();
        Object id = args[0];
        String oldValue = snapshot(target, id);

        try {
            Object result = joinPoint.proceed();

            if (result instanceof BaseDTO dto) {
                String entityId = dto.getId() != null
                        ? toId(dto.getId())
                        : toId(id);

                auditLogService.log(
                        "UPDATE",
                        entityType,
                        entityId,
                        oldValue,
                        toJson(dto),
                        MDC.get(CorrelationIdFilter.MDC_KEY),
                        "SUCCESS"
                );
            }

            return result;
        } catch (Throwable ex) {
            log.error("Audit aspect caught UPDATE failure for id {}", id, ex);

            auditLogService.log(
                    "UPDATE",
                    entityType,
                    toId(id),
                    oldValue,
                    null,
                    MDC.get(CorrelationIdFilter.MDC_KEY),
                    "FAILED"
            );

            throw ex;
        }
    }

    @Around(
            "execution(public * com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl+.delete(..))"
    )
    public Object aroundDelete(ProceedingJoinPoint joinPoint) throws Throwable {
        log.info(">>> AuditLogAspect aroundDelete triggered: {}",
                joinPoint.getSignature());

        Object target = joinPoint.getTarget();
        String entityType = getEntityType(target);

        if (entityType == null) {
            return joinPoint.proceed();
        }

        Object[] args = joinPoint.getArgs();
        Object id = args[0];
        String oldValue = snapshot(target, id);

        try {
            Object result = joinPoint.proceed();

            auditLogService.log(
                    "DELETE",
                    entityType,
                    toId(id),
                    oldValue,
                    null,
                    MDC.get(CorrelationIdFilter.MDC_KEY),
                    "SUCCESS"
            );

            return result;
        } catch (Throwable ex) {
            auditLogService.log(
                    "DELETE",
                    entityType,
                    toId(id),
                    oldValue,
                    null,
                    MDC.get(CorrelationIdFilter.MDC_KEY),
                    "FAILED"
            );

            throw ex;
        }
    }

    private String snapshot(Object target, Object id) {
        try {
            Object entity = findEntity(target, id);
            if (entity == null) {
                return null;
            }
            return toJson(toDto(target, entity));
        } catch (Exception e) {
            log.warn("Cannot build audit snapshot for id {}: {}",
                    id, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Object toDto(Object target, Object entity) throws Exception {
        Method method =
                BaseCrudServiceImpl.class.getDeclaredMethod("getMapper");
        method.setAccessible(true);

        BaseCrudMapper<BaseEntity, BaseDTO> mapper =
                (BaseCrudMapper<BaseEntity, BaseDTO>) method.invoke(target);

        return mapper.toResponse((BaseEntity) entity);
    }

    private Object findEntity(Object target, Object id) {
        try {
            Method method =
                    BaseCrudServiceImpl.class.getDeclaredMethod("getRepository");
            method.setAccessible(true);

            @SuppressWarnings("unchecked")
            BaseCrudRepository<Object, Object> repository =
                    (BaseCrudRepository<Object, Object>) method.invoke(target);

            return repository.findById(id).orElse(null);
        } catch (Exception e) {
            throw new IllegalStateException(
                    "Cannot retrieve entity for audit log", e);
        }
    }

    private String getEntityType(Object target) {
        Class<?> entityClass =
                getEntityClass(AopUtils.getTargetClass(target));

        if (entityClass == null) {
            return null;
        }

        ResourcePermission permission =
                entityClass.getAnnotation(ResourcePermission.class);

        return permission == null ? null : permission.value();
    }

    private Class<?> getEntityClass(Class<?> serviceClass) {
        Class<?> current = serviceClass;

        while (current != null) {
            Type generic = current.getGenericSuperclass();

            if (generic instanceof ParameterizedType type) {
                if (type.getRawType() instanceof Class<?> raw
                        && BaseCrudServiceImpl.class.isAssignableFrom(raw)) {

                    Type argument = type.getActualTypeArguments()[0];

                    if (argument instanceof Class<?> entityClass) {
                        return entityClass;
                    }
                }
            }

            current = current.getSuperclass();
        }

        return null;
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Cannot serialize audit data: {}", e.getMessage());
            return null;
        }
    }

    private String toId(Object id) {
        return id == null ? null : id.toString();
    }
}
