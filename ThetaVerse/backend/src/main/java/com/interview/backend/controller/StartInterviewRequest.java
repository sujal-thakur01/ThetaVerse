package com.interview.backend.controller;

import lombok.Data;

@Data
public class StartInterviewRequest {
    private String companyName;
    private String position;
    private String roundTypes; // e.g., "Technical, HLD, HR"
    private String mood; // Strict, Friendly, Medium
    private String mode; // AI or HUMAN
    private Long userId;
    private String resumeText;
}
