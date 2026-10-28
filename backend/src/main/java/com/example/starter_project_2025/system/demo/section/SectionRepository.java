
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SectionRepository
        extends BaseCrudRepository<Section, Long> {

    List<Section> findByCourse_IdOrderByOrderIndexAsc(Long courseId);
}
