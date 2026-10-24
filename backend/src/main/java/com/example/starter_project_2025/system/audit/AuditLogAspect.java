package com.example.starter_project_2025.system.audit;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.aop.support.AopUtils;
import org.springframework.stereotype.Component;

import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;

@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;
    private static final Logger log = LoggerFactory.getLogger(AuditLogAspect.class);

    @AfterReturning(
            pointcut = "execution(public * com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl+.create(..))",
            returning = "result"
    )
    public void afterCreate(JoinPoint joinPoint, Object result) {

        if (!(result instanceof BaseDTO dto)) return;

        String entityType = getEntityType(joinPoint.getTarget());
        if (entityType == null) return;

        auditLogService.log(
                "CREATE",
                entityType,
                toId(dto.getId()),
                null,
                toJson(dto),
                null
        );
    }

    @Around(
            "execution(public * com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl+.update(..))"
    )
    public Object aroundUpdate(ProceedingJoinPoint joinPoint) throws Throwable {

        Object target = joinPoint.getTarget();
        String entityType = getEntityType(target);

        if (entityType == null) {
            return joinPoint.proceed();
        }

        Object[] args = joinPoint.getArgs();
        Object id = args[0];

        String oldValue = snapshot(target, id);

        Object result = joinPoint.proceed();

        if (result instanceof BaseDTO dto) {
            auditLogService.log(
                    "UPDATE",
                    entityType,
                    toId(dto.getId()),
                    oldValue,
                    toJson(dto),
                    null
            );
        }

        return result;
    }

    @Around(
            "execution(public * com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl+.delete(..))"
    )
    public Object aroundDelete(ProceedingJoinPoint joinPoint) throws Throwable {

        Object target = joinPoint.getTarget();
        String entityType = getEntityType(target);

        if (entityType == null) {
            return joinPoint.proceed();
        }

        Object[] args = joinPoint.getArgs();
        Object id = args[0];

        String oldValue = snapshot(target, id);

        Object result = joinPoint.proceed();

        auditLogService.log(
                "DELETE",
                entityType,
                toId(id),
                oldValue,
                null,
                null
        );

        return result;
    }

    private String snapshot(Object target, Object id) {
        try {
            Object entity = findEntity(target, id);
            if (entity == null) return null;
            return toJson(toDto(target, entity));
        } catch (Exception e) {
            log.warn("Cannot build audit snapshot for id {}: {}", id, e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private Object toDto(Object target, Object entity) throws Exception {
        Method method = BaseCrudServiceImpl.class.getDeclaredMethod("getMapper");
        method.setAccessible(true);

        BaseCrudMapper<BaseEntity, BaseDTO> mapper =
                (BaseCrudMapper<BaseEntity, BaseDTO>) method.invoke(target);

        return mapper.toResponse((BaseEntity) entity);
    }

    private Object findEntity(Object target, Object id) {

        try {
            Method method = BaseCrudServiceImpl.class
                    .getDeclaredMethod("getRepository");

            method.setAccessible(true);

            @SuppressWarnings("unchecked")
            BaseCrudRepository<Object, Object> repository =
                    (BaseCrudRepository<Object, Object>) method.invoke(target);

            return repository.findById(id).orElse(null);

        } catch (Exception e) {
            throw new IllegalStateException(
                    "Cannot retrieve entity for audit log", e
            );
        }
    }

    private String getEntityType(Object target) {

        Class<?> entityClass = getEntityClass(AopUtils.getTargetClass(target));

        if (entityClass == null) return null;

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
        if (value == null) return null;

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