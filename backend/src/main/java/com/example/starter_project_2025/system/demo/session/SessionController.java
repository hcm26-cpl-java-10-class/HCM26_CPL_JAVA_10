package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sessions")
@Tag(name = "Class Schedule & Session", description = "Sessions belong to a calendar version; times use Asia/Ho_Chi_Minh")
public class SessionController extends BaseCrudController<Long, SessionDTO, SessionFilter> {
    private final SessionService sessionService;
    @Override protected BaseCrudService<Long, SessionDTO, SessionFilter> getService() { return sessionService; }

    @PatchMapping("/{id}/cancel")
    @Operation(summary = "Cancel a scheduled session in a draft or the active version")
    public SessionDTO cancelSession(@PathVariable Long id, @Valid @RequestBody SessionCancelDTO cancelDTO) {
        return sessionService.cancelSession(id, cancelDTO);
    }
}
