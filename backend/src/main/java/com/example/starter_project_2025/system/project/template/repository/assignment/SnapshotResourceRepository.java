package com.example.starter_project_2025.system.project.template.repository.assignment;

import com.example.starter_project_2025.system.project.template.domain.assignment.SnapshotResource;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SnapshotResourceRepository extends JpaRepository<SnapshotResource, Long> {
    List<SnapshotResource> findAllBySnapshotIdOrderByIdAsc(Long snapshotId);
}
