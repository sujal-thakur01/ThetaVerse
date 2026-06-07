package com.interview.backend.repository;

import com.interview.backend.entity.InterviewLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterviewLogRepository extends JpaRepository<InterviewLog, Long> {
    List<InterviewLog> findBySessionIdOrderByTimestampAsc(Long sessionId);

    List<InterviewLog> findTop5BySessionIdOrderByIdDesc(Long sessionId); // Added to fetch latest logs

    long countBySessionId(Long sessionId); // Added to count logs by session
}
