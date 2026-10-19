package com.example.starter_project_2025.base.crud.controller;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

public abstract class BaseCrudController<
        I,
        D extends BaseDTO,
        F extends BaseFilter> {

    protected abstract BaseCrudService<I, D, F> getService();

    @GetMapping
    public ResponseEntity<Page<D>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute F filter
    ) {
        return ResponseEntity.ok(
                getService().getAll(pageable, search, filter)
        );
    }

    @GetMapping("/{id}")
    public ResponseEntity<D> getById(
            @PathVariable I id
    ) {
        return ResponseEntity.ok(getService().getById(id));
    }

    @PostMapping
    public ResponseEntity<D> create(
            @Validated(OnCreate.class) @RequestBody D request
    ) {
        return ResponseEntity.ok(getService().create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<D> update(
            @PathVariable I id,
            @Validated(OnUpdate.class) @RequestBody D request
    ) {
        return ResponseEntity.ok(getService().update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable I id
    ) {
        getService().delete(id);
        return ResponseEntity.noContent().build();
    }
}
