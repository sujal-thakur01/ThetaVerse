package com.interview.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class InterviewerProfileResponse {
    private Long interviewerId;
    private String name;
    private String email;
    private String headline;
    private String bio;
}
