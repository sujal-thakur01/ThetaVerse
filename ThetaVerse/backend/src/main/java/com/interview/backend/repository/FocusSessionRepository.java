package com.interview.backend.repository;

import com.interview.backend.entity.FocusSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FocusSessionRepository extends JpaRepository<FocusSession, Long> {
}
