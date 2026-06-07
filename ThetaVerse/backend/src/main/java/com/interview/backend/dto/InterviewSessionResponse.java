package com.interview.backend.dto;

import java.time.LocalDateTime;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewSessionResponse {
    private Long id; // Unique identifier for the session
    private String companyName; // Name of the company
    private String position; // Position for the interview
    private String roundTypes; // Types of rounds in the interview
    private String mood; // Mood of the interviewer
    private String mode; // AI or HUMAN
    private LocalDateTime startTime; // Start time of the session
    private LocalDateTime endTime; // End time of the session
    private LocalDateTime scheduledAt;
    private Integer durationMinutes;
    private String resumeText; // Resume text of the candidate
    private String interviewerName;
    private String interviewerEmail;
    private String meetingLink;
}