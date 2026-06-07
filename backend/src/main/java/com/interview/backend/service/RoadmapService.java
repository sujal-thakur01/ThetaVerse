package com.interview.backend.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interview.backend.controller.GenerateRoadmapRequest;
import com.interview.backend.dto.RoadmapGenerationResponse;
import com.interview.backend.entity.Roadmap;
import com.interview.backend.entity.RoadmapTopic;
import com.interview.backend.entity.Subtopic;
import com.interview.backend.entity.TargetProfile;
import com.interview.backend.entity.User;
import com.interview.backend.repository.RoadmapRepository;
import com.interview.backend.repository.RoadmapTopicRepository;
import com.interview.backend.repository.TargetProfileRepository;
import com.interview.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class RoadmapService {

        private final RoadmapRepository roadmapRepository;
        private final RoadmapTopicRepository roadmapTopicRepository;
        private final TargetProfileRepository targetProfileRepository;
        private final UserRepository userRepository;
        private final GhostService ghostService;
        private final ChatClient chatClient;

        /**
         * Generates a roadmap for a specific target profile.
         * Uses Spring AI Mistral to generate topics based on the company and role.
         */
        @Transactional
        public Roadmap generateRoadmap(GenerateRoadmapRequest request) {
                User user = userRepository.findById(request.getUserId())
                                .orElseThrow(() -> new RuntimeException("User not found"));
                System.out.println("[RoadmapService] Fetched User: " + user.getId());

                int days = 30;
                if (request.getTargetDays() != null) {
                        days = request.getTargetDays();
                }

                double dailyHours = 4.0;
                if (request.getDailyHourLimit() != null) {
                        dailyHours = request.getDailyHourLimit();
                }
                double totalHours = days * dailyHours;

                System.out.println("[RoadmapService] Calculating for " + days + " days at " + dailyHours + " hrs/day = "
                                + totalHours + " total hours");

                TargetProfile profile = TargetProfile.builder()
                                .user(user)
                                .roleName(request.getPosition())
                                .companyName(request.getCompanyName())
                                .dailyHourLimit(dailyHours)
                                .maxDailyThreshold(dailyHours + 2.0) // Provide a small buffer over the limit
                                .targetDate(LocalDate.now().plusDays(days))
                                .build();
                profile = targetProfileRepository.save(profile);
                System.out.println("[RoadmapService] Saved TargetProfile: " + profile.getId());

                Roadmap roadmap = Roadmap.builder()
                                .targetProfile(profile)
                                .createdAt(LocalDateTime.now())
                                .startDate(LocalDate.now())
                                .endDate(LocalDate.now().plusDays(days))
                                .build();

                roadmap = roadmapRepository.save(roadmap);
                System.out.println("[RoadmapService] Saved initial Roadmap: " + roadmap.getId());

                BeanOutputConverter<RoadmapGenerationResponse> converter = new BeanOutputConverter<>(
                                RoadmapGenerationResponse.class);
                String format = converter.getFormat();

                // Calculate approx topics based on time
                int requestedTopicCount = Math.max(5, (int) (totalHours / 10)); // Assume ~10 hours per topic on average

                String prompt = String.format("""
                                Act as an expert technical interviewer and web scraper simulator.
                                Generate a study roadmap for a %s at %s focusing heavily on '%s'.
                                The user has %d days to prepare, dedicating %.1f hours per day (Total %f hours).
                                Generate exactly %d key topics that fit perfectly into this schedule.
                                For each topic, provide a list of highly specific subtopics to cover.
                                For referenceLinks, ONLY provide clean Google Search URLs (e.g., https://www.google.com/search?q=Search+Term) to avoid dead links.
                                %s
                                """,
                                request.getPosition(), request.getCompanyName(), request.getMajorTopic(),
                                days, dailyHours, totalHours, requestedTopicCount, format);

                System.out.println("[RoadmapService] Calling AI with prompt...");
                String aiResponse = chatClient.prompt()
                                .user(prompt)
                                .call()
                                .content();
                System.out.println("[RoadmapService] Received AI Response length: " + aiResponse.length());
                System.out.println("[RoadmapService] RAW AI RESPONSE: \n" + aiResponse);

                List<RoadmapTopic> topics = new ArrayList<>();
                try {
                        RoadmapGenerationResponse responseDto = converter.convert(aiResponse);
                        List<RoadmapGenerationResponse.RoadmapTopicDto> parsedTopics = new ArrayList<>();
                        if (responseDto != null && responseDto.getTopics() != null) {
                                parsedTopics = responseDto.getTopics();
                        }
                        System.out.println(
                                        "[RoadmapService] AI Response parsed successfully into RoadmapGenerationResponse. Found topics: "
                                                        + parsedTopics.size());

                        for (int i = 0; i < parsedTopics.size(); i++) {
                                RoadmapGenerationResponse.RoadmapTopicDto t = parsedTopics.get(i);
                                double estimatedHours = 5.0;
                                if (t.getEstimatedHours() != null) {
                                        estimatedHours = t.getEstimatedHours();
                                }

                                RoadmapTopic.RoadmapTopicBuilder builder = RoadmapTopic.builder()
                                                .roadmap(roadmap)
                                                .title(t.getTitle())
                                                .priority(i < 2 ? "High" : "Medium")
                                                .estimatedHours(estimatedHours)
                                                .referenceLinks(t.getReferenceLinks())
                                                .isCompleted(false)
                                                .sequenceOrder(i + 1);

                                if (t.getSubtopics() != null && !t.getSubtopics().isEmpty()) {
                                        System.out.println("[RoadmapService] Parsing " + t.getSubtopics().size()
                                                        + " subtopics for: " + t.getTitle());
                                        List<Subtopic> subObjList = new ArrayList<>();
                                                                                for (int j = 0; j < t.getSubtopics().size(); j++) {
                                                                                                subObjList.add(new Subtopic(t.getSubtopics().get(j), false, j + 1));
                                        }
                                        builder.subtopics(subObjList);
                                } else {
                                        System.out.println("[RoadmapService] WARN: No subtopics found for topic: "
                                                        + t.getTitle());
                                        builder.subtopics(new ArrayList<>());
                                }
                                topics.add(builder.build());
                        }
                } catch (Exception e) {
                        System.err.println("AI Parsing failed: " + e.getMessage());
                        System.out.println("[RoadmapService] Falling back to default topic due to parsing failure");
                        // Fallback
                        topics.add(RoadmapTopic.builder()
                                        .roadmap(roadmap)
                                        .title("Core Fundamentals: " + request.getMajorTopic())
                                        .priority("High")
                                        .estimatedHours(5.0)
                                        .referenceLinks("https://leetcode.com/discuss/interview-question")
                                        .isCompleted(false)
                                        .sequenceOrder(1)
                                        .build());
                }

                roadmapTopicRepository.saveAll(topics);
                roadmap.setTopics(topics);
                System.out.println("[RoadmapService] Saved " + topics.size() + " RoadmapTopics");

                // Initialize Ghost Performance dynamically based on topics / days
                double computedVelocity = (double) topics.size() / days;
                ghostService.initializeGhost(roadmap, computedVelocity);
                System.out.println("[RoadmapService] Initialized Ghost Performance for Roadmap: " + roadmap.getId() + " at pace " + computedVelocity);
                System.out.println("[RoadmapService] Final Roadmap state: " + roadmap);
                return roadmap;
        }

        public Roadmap getRoadmap(Long id) {
                return roadmapRepository.findById(id)
                                .orElseThrow(() -> new RuntimeException("Roadmap not found"));
        }

        public List<Roadmap> getRoadmapsByUser(Long userId) {
                return roadmapRepository.findByTargetProfile_UserId(userId);
        }

        @Transactional
        public RoadmapTopic markTopicComplete(Long topicId) {
                RoadmapTopic topic = roadmapTopicRepository.findById(topicId)
                                .orElseThrow(() -> new RuntimeException("Topic not found"));
                topic.setIsCompleted(true);
                return roadmapTopicRepository.save(topic);
        }

        @Transactional
        public RoadmapTopic markSubtopicComplete(Long topicId, String subtopicTitle) {
                RoadmapTopic topic = roadmapTopicRepository.findById(topicId)
                                .orElseThrow(() -> new RuntimeException("Topic not found"));
                
                if (topic.getSubtopics() != null) {
                    for (Subtopic sub : topic.getSubtopics()) {
                        if (sub.getTitle().equals(subtopicTitle)) {
                            sub.setIsCompleted(true);
                            break;
                        }
                    }
                }
                
                return roadmapTopicRepository.save(topic);
        }
}
