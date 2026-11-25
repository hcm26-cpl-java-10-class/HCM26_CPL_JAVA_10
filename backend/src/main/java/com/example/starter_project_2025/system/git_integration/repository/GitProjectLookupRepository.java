package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.project.domain.Project;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * GI-04: the few project reads Git Integration needs, kept inside this module
 * so the project module's repository is not changed for it.
 */
public interface GitProjectLookupRepository extends Repository<Project, Long> {

    Optional<Project> findById(Long id);

    /** Serializes link attempts on the same master project. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :id")
    Optional<Project> lockById(@Param("id") Long id);

    /** Number of active modules (child projects) of a master project. */
    @Query("select count(p) from Project p where p.parentProject.id = :masterId and p.isActive = true")
    long countModules(@Param("masterId") Long masterId);

    /** GI-06: projects by id (code and name for the member list). */
    @Query("select p from Project p where p.id in :ids")
    List<Project> findAllByIds(@Param("ids") Collection<Long> ids);

    /** SY-05: direct children of the given projects (one level of the module tree). */
    @Query("select p.id from Project p where p.parentProject.id in :parentIds")
    List<Long> findChildIds(@Param("parentIds") Collection<Long> parentIds);
}
