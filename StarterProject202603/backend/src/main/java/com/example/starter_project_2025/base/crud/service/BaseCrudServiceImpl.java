package com.example.starter_project_2025.base.crud.service;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.spec.AutoSpecBuilder;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.base.crud.CrudAction;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.lang.reflect.ParameterizedType;
import java.util.ArrayList;
import java.util.List;

@Transactional
public abstract class BaseCrudServiceImpl<
        E extends BaseEntity,
        I,
        D extends BaseDTO,
        F extends BaseFilter> implements BaseCrudService<I, D, F> {

    @Autowired
    protected  AutoSpecBuilder autoSpecBuilder;

    protected abstract BaseCrudRepository<E, I> getRepository();
    protected abstract BaseCrudMapper<E, D> getMapper();
    protected abstract String[] searchableFields();

    protected void beforeCreate(E entity, D request, ValidationContext ctx) {}
    protected void afterCreate(E entity, D request) {}

    protected void beforeUpdate(E entity, D request, ValidationContext ctx) {}
    protected void afterUpdate(E entity, D request) {}

    protected void beforeDelete(E entity) {}
    protected void afterDelete(E entity) {}

    protected void checkPermission(CrudAction action) {

        String permission = buildPermission(action);

        check(permission);
    }

    @Override
    public D create(D request) {

        checkPermission(CrudAction.CREATE);

        E entity = getMapper().toEntity(request);

        ValidationContext ctx = new ValidationContext();

        beforeCreate(entity, request, ctx);

        ctx.throwIfErrors();

        E saved = getRepository().save(entity);

        afterCreate(saved, request);

        return getMapper().toResponse(saved);
    }

    @Override
    public D update(I id, D request) {

        checkPermission(CrudAction.UPDATE);

        E entity = getRepository().findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));

        ValidationContext ctx = new ValidationContext();

        beforeUpdate(entity, request, ctx);

        ctx.throwIfErrors();

        getMapper().update(entity, request);

        E saved = getRepository().save(entity);

        afterUpdate(saved, request);

        return getMapper().toResponse(saved);
    }

    @Override
    public void delete(I id) {

        checkPermission(CrudAction.DELETE);

        E entity = getRepository().findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));

        beforeDelete(entity);

        getRepository().delete(entity);

        afterDelete(entity);
    }

    @Override
    public D getById(I id) {

        checkPermission(CrudAction.READ);

        return getRepository().findById(id)
                .map(getMapper()::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException("Entity not found"));
    }

    @Override
    public Page<D> getAll(Pageable pageable, String search, F filter) {

        checkPermission(CrudAction.READ);

        Specification<E> spec = Specification.where(null);

        Specification<E> filterSpec = autoSpecBuilder.build(filter);
        Specification<E> searchSpec = buildSearchSpec(search);

        if (filterSpec != null) spec = spec.and(filterSpec);
        if (searchSpec != null) spec = spec.and(searchSpec);

        return getRepository().findAll(spec, pageable)
                .map(getMapper()::toResponse);
    }

    private String buildPermission(CrudAction action) {
        return getPermissionPrefix() + "_" + action.name();
    }

    private String getPermissionPrefix() {

        ResourcePermission annotation =
                getEntityClass().getAnnotation(ResourcePermission.class);

        if (annotation == null) {
            throw new IllegalStateException(
                    "Missing @ResourcePermission on entity: " + getEntityClass().getName()
            );
        }

        return annotation.value();
    }

    @SuppressWarnings("unchecked")
    private Class<E> getEntityClass() {

        ParameterizedType type =
                (ParameterizedType) getClass().getGenericSuperclass();

        return (Class<E>) type.getActualTypeArguments()[0];
    }

    public void check(String permission) {

        Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();

        if (auth == null) {
            throw new AccessDeniedException("Unauthorized");
        }

        boolean allowed = auth.getAuthorities()
                .stream()
                .anyMatch(a -> a.getAuthority().equals(permission));

        String email;

        Object principal = auth.getPrincipal();

        if (principal instanceof UserPrincipal userDetails) {
            email = userDetails.getUsername();
        } else {
            email = principal.toString();
        }

        if (!allowed) {
            throw new AccessDeniedException(
                   email + "do not have permission: " + permission
            );
        }
    }

    private Specification<E> buildSearchSpec(String keyword) {

        if (keyword == null || keyword.isBlank()) return null;

        String likePattern = "%" + keyword.toLowerCase() + "%";

        return (root, query, cb) -> {

            List<Predicate> predicates = new ArrayList<>();

            for (String field : searchableFields()) {

                try {
                    var path = root.get(field);
                    if (!String.class.equals(path.getJavaType())) {
                        continue;
                    }
                    predicates.add(cb.like(cb.lower(path.as(String.class)), likePattern));

                } catch (IllegalArgumentException ex) {
                    throw new RuntimeException("Invalid searchable field: " + field, ex);
                }
            }

            if (predicates.isEmpty()) {
                return null;
            }

            return cb.or(predicates.toArray(new Predicate[0]));
        };
    }
}
