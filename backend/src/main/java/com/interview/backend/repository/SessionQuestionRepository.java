package com.interview.backend.repository;

import com.interview.backend.entity.SessionQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SessionQuestionRepository extends JpaRepository<SessionQuestion, Long> {
    List<SessionQuestion> findTop5BySessionIdOrderByIdDesc(Long sessionId);

    long countBySessionId(Long sessionId);
}
