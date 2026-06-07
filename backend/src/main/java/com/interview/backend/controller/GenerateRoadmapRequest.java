package com.interview.backend.controller;

import lombok.Data;

@Data
public class GenerateRoadmapRequest {
    private String companyName;
    private String position;
    private String majorTopic;
    private Integer targetDays;
    private Double dailyHourLimit;
    private Long userId;
}
