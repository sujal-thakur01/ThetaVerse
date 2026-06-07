package com.interview.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InterviewLogResponse {
    private Long id; // Unique identifier for the log
    private String role; // Role of the person who logged the entry
    private String content; // Content of the log
    private LocalDateTime timestamp; // When the log was created
}