package com.interview.backend.dto;

import lombok.Data;

@Data
public class BookHumanInterviewRequest {
    private Long userId;
    private Long interviewerId;
    private Long slotId;
    private String companyName;
    private String position;
    private String roundTypes;
    private String resumeText;
}
