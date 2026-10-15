package com.example.starter_project_2025.system.schedule.notification;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/notifications")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Notification", description = "APIs for managing user notifications")
public class NotificationController
        extends BaseCrudDataIoController<Notification, Long, NotificationDTO, NotificationFilter> {

    NotificationService notificationService;
    NotificationRepository notificationRepository;

    @Override
    protected BaseCrudService<Long, NotificationDTO, NotificationFilter> getService() {
        return notificationService;
    }

    @Override
    protected BaseCrudRepository<Notification, Long> getRepository() {
        return notificationRepository;
    }

    @Override
    protected Class<Notification> getEntityClass() {
        return Notification.class;
    }

    @PatchMapping("/{id}/read")
    @Operation(summary = "Mark notification as read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        notificationService.markAsRead(id);
        return ResponseEntity.noContent().build();
    }
}