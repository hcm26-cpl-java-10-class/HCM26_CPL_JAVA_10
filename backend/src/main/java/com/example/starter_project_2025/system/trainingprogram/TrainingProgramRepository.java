package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TrainingProgramRepository
        extends JpaRepository<TrainingProgram, Long>,
                JpaSpecificationExecutor<TrainingProgram> {

    @Query("""
        select distinct p.region
        from TrainingProgram p
        where p.region is not null
          and trim(p.region) <> ''
        order by p.region
        """)
    List<String> findDistinctRegions();

    boolean existsByCodeAndVersion(String code, String version);

    Optional<TrainingProgram> findByCodeAndVersion(String code, String version);

    /**
     * Tìm kiếm tất cả chương trình phù hợp điều kiện.
     * Dùng cho chức năng export, không phân trang.
     * Tải kèm danh sách môn học để tránh N+1 queries.
     */
    @Query("""
        select distinct p
        from TrainingProgram p
        left join fetch p.subjects
        where (
            :search is null
            or :search = ''
            or lower(p.code) like lower(concat('%', :search, '%'))
            or lower(p.name) like lower(concat('%', :search, '%'))
            or lower(coalesce(p.version, '')) like lower(concat('%', :search, '%'))
        )
        and (
            :status is null
            or p.status = :status
        )
        and (
            :region is null
            or :region = ''
            or lower(coalesce(p.region, '')) like lower(concat('%', :region, '%'))
        )
        order by p.id desc
        """)
    List<TrainingProgram> searchAll(
            @Param("search") String search,
            @Param("status") ProgramStatus status,
            @Param("region") String region
    );

    /**
     * Tìm kiếm chương trình có phân trang phía server.
     * Không fetch collection ở đây để tránh lỗi phân trang với fetch join.
     */
    @Query("""
        select p
        from TrainingProgram p
        where (
            :search is null
            or :search = ''
            or lower(p.code) like lower(concat('%', :search, '%'))
            or lower(p.name) like lower(concat('%', :search, '%'))
            or lower(coalesce(p.version, '')) like lower(concat('%', :search, '%'))
        )
        and (
            :status is null
            or p.status = :status
        )
        and (
            :region is null
            or :region = ''
            or lower(coalesce(p.region, '')) like lower(concat('%', :region, '%'))
        )
        """)
    org.springframework.data.domain.Page<TrainingProgram> searchPage(
            @Param("search") String search,
            @Param("status") ProgramStatus status,
            @Param("region") String region,
            org.springframework.data.domain.Pageable pageable
    );
}