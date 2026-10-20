package com.example.starter_project_2025.system.schedule.session_audit.repository;

import com.example.starter_project_2025.system.schedule.session_audit.entity.SessionStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Chỉ đọc/ghi thêm (append-only) — không có thao tác cập nhật/xóa (BR-SES-07).
 */
public interface SessionStatusHistoryRepository extends JpaRepository<SessionStatusHistory, Long> {

    List<SessionStatusHistory> findBySessionIdOrderByChangedAtAscIdAsc(Long sessionId);
}
