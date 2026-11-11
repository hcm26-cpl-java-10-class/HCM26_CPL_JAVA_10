package com.example.starter_project_2025.system.demo.book;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BookRepository extends BaseCrudRepository<Book, Long> {

    boolean existsByName(String name);
}
