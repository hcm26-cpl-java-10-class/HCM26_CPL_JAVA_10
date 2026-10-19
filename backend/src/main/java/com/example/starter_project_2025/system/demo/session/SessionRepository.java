package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionRepository extends BaseCrudRepository<Session,Long> {

    List<Session> findByClassId(Long classId);

    boolean existsByTopicId(Long topicId);
}
