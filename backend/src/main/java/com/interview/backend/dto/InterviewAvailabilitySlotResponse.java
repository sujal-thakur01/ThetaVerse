package com.interview.backend.dto;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InterviewAvailabilitySlotResponse {
    private Long slotId;
    private Long interviewerId;
    private String interviewerName;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String googleMeetLink;
    private Boolean booked;
}
