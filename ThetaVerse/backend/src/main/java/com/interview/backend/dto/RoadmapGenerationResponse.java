package com.interview.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class RoadmapGenerationResponse {
    private List<RoadmapTopicDto> topics;

    @Data
    public static class RoadmapTopicDto {
        private String title;
        private Double estimatedHours;
        private String referenceLinks;
        private List<String> subtopics;
    }
}
