package com.example.starter_project_2025.base.crud.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.repository.NoRepositoryBean;

@NoRepositoryBean
public interface BaseCrudRepository<E, I> extends
        JpaRepository<E, I>,
        JpaSpecificationExecutor<E> {
}
