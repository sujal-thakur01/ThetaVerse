package com.interview.backend.dto;

import java.time.LocalDateTime;

import lombok.Data;

@Data
public class CreateAvailabilitySlotRequest {
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String googleMeetLink;
}
