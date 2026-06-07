package com.interview.backend.dto;

import lombok.Data;

@Data
public class CreateInterviewerProfileRequest {
    private String headline;
    private String bio;
}
