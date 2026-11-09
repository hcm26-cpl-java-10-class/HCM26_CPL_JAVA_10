package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CourseRepository extends BaseCrudRepository<Course, Long> {

    boolean existsByName(String name);
    java.util.Optional<Course> findByName(String name);
    boolean existsByCategories_Id(Long id);
    @org.springframework.data.jpa.repository.Query("select c.id, count(co) from Course co join co.categories c where upper(co.publicationStatus) = 'PUBLISHED' group by c.id")
    java.util.List<Object[]> countPublishedByCategory();
}
