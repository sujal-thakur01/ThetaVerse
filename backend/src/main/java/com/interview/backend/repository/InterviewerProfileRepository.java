package com.interview.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.interview.backend.entity.InterviewerProfile;

@Repository
public interface InterviewerProfileRepository extends JpaRepository<InterviewerProfile, Long> {
    Optional<InterviewerProfile> findByUserId(Long userId);
    List<InterviewerProfile> findAllByOrderByIdAsc();
}
