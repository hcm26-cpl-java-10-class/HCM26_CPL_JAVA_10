package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SnapshotResourceRepository extends JpaRepository<SnapshotResource, Long> {
    List<SnapshotResource> findAllBySnapshotIdOrderByIdAsc(Long snapshotId);
}
