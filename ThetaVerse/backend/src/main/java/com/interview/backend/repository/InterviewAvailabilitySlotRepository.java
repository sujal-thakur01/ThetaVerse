package com.interview.backend.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.interview.backend.entity.InterviewAvailabilitySlot;

@Repository
public interface InterviewAvailabilitySlotRepository extends JpaRepository<InterviewAvailabilitySlot, Long> {
    List<InterviewAvailabilitySlot> findByInterviewerIdAndBookedFalseOrderByStartTimeAsc(Long interviewerId);
    List<InterviewAvailabilitySlot> findByInterviewerIdOrderByStartTimeAsc(Long interviewerId);
}
