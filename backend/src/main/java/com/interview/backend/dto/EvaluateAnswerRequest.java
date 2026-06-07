package com.interview.backend.dto;

import lombok.Data;

@Data
public class EvaluateAnswerRequest {
    private String userAnswer; // User's answer to the question
    private String postureFeedback; // Feedback on the candidate's posture
}