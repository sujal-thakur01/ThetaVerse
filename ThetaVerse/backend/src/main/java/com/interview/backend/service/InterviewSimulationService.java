package com.interview.backend.service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.interview.backend.controller.StartInterviewRequest;
import com.interview.backend.dto.BookHumanInterviewRequest;
import com.interview.backend.dto.CreateAvailabilitySlotRequest;
import com.interview.backend.dto.CreateInterviewerProfileRequest;
import com.interview.backend.dto.EvaluateAnswerRequest;
import com.interview.backend.dto.InterviewAvailabilitySlotResponse;
import com.interview.backend.dto.InterviewLogResponse;
import com.interview.backend.dto.InterviewSessionResponse;
import com.interview.backend.dto.InterviewerProfileResponse;
import com.interview.backend.entity.FriendlyPersona;
import com.interview.backend.entity.InterviewAvailabilitySlot;
import com.interview.backend.entity.InterviewLog;
import com.interview.backend.entity.InterviewMode;
import com.interview.backend.entity.InterviewSession;
import com.interview.backend.entity.InterviewerPersona;
import com.interview.backend.entity.InterviewerProfile;
import com.interview.backend.entity.MediumPersona;
import com.interview.backend.entity.Role;
import com.interview.backend.entity.SessionQuestion;
import com.interview.backend.entity.StrictPersona;
import com.interview.backend.entity.TargetProfile;
import com.interview.backend.entity.User;
import com.interview.backend.repository.InterviewAvailabilitySlotRepository;
import com.interview.backend.repository.InterviewLogRepository;
import com.interview.backend.repository.InterviewSessionRepository;
import com.interview.backend.repository.InterviewerProfileRepository;
import com.interview.backend.repository.SessionQuestionRepository;
import com.interview.backend.repository.TargetProfileRepository;
import com.interview.backend.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InterviewSimulationService {

        private static final int QUESTIONS_PER_TOPIC = 5;

        private final InterviewSessionRepository sessionRepository;
        private final SessionQuestionRepository questionRepository;
        private final TargetProfileRepository profileRepository;
        private final UserRepository userRepository;
        private final InterviewLogRepository logRepository;
        private final InterviewerProfileRepository interviewerProfileRepository;
        private final InterviewAvailabilitySlotRepository slotRepository;
        private final ChatClient chatClient;

        @Transactional
        public InterviewSession startSession(StartInterviewRequest request) {
                if (request.getMode() != null && "HUMAN".equalsIgnoreCase(request.getMode())) {
                        throw new RuntimeException("Use /api/interviews/book-human for HUMAN interviews");
                }

                User user = userRepository.findById(request.getUserId())
                                .orElseThrow(() -> new RuntimeException("User not found"));

                TargetProfile profile = TargetProfile.builder()
                                .user(user)
                                .roleName(request.getPosition())
                                .companyName(request.getCompanyName())
                                .build();
                profile = profileRepository.save(profile);

                InterviewerPersona persona;
                if ("Strict".equalsIgnoreCase(request.getMood())) {
                        persona = new StrictPersona();
                } else if ("Friendly".equalsIgnoreCase(request.getMood())) {
                        persona = new FriendlyPersona();
                } else {
                        persona = new MediumPersona();
                }

                InterviewSession session = InterviewSession.builder()
                                .user(profile.getUser())
                                .targetProfile(profile)
                                .interviewerPersona(persona)
                                .roundTypes(request.getRoundTypes())
                                .mode(InterviewMode.AI)
                                .startTime(LocalDateTime.now())
                                .resumeText(request.getResumeText())
                                .build();

                return sessionRepository.save(session);
        }

        @Transactional
        public InterviewSession bookHumanInterview(BookHumanInterviewRequest request) {
                User student = userRepository.findById(request.getUserId())
                                .orElseThrow(() -> new RuntimeException("Student not found"));
                User interviewer = userRepository.findById(request.getInterviewerId())
                                .orElseThrow(() -> new RuntimeException("Interviewer not found"));

                if (interviewer.getRole() != Role.INTERVIEWER) {
                        throw new RuntimeException("Selected user is not an interviewer");
                }

                InterviewAvailabilitySlot slot = slotRepository.findById(request.getSlotId())
                                .orElseThrow(() -> new RuntimeException("Slot not found"));

                if (!slot.getInterviewer().getId().equals(interviewer.getId())) {
                        throw new RuntimeException("Slot does not belong to selected interviewer");
                }

                if (Boolean.TRUE.equals(slot.getBooked())) {
                        throw new RuntimeException("Slot is already booked");
                }

                TargetProfile profile = TargetProfile.builder()
                                .user(student)
                                .roleName(request.getPosition())
                                .companyName(request.getCompanyName())
                                .build();
                profile = profileRepository.save(profile);

                int duration = (int) Math.max(1, Duration.between(slot.getStartTime(), slot.getEndTime()).toMinutes());

                InterviewSession session = InterviewSession.builder()
                                .user(student)
                                .targetProfile(profile)
                                .interviewerUser(interviewer)
                                .roundTypes(request.getRoundTypes())
                                .mode(InterviewMode.HUMAN)
                                .startTime(LocalDateTime.now())
                                .scheduledAt(slot.getStartTime())
                                .durationMinutes(duration)
                                .externalMeetingLink(slot.getGoogleMeetLink())
                                .resumeText(request.getResumeText())
                                .build();

                slot.setBooked(true);
                slotRepository.save(slot);

                return sessionRepository.save(session);
        }

        @Transactional(readOnly = true)
        public InterviewSessionResponse getSession(Long sessionId) {
                InterviewSession session = sessionRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Session not found"));

                return toResponse(session);
        }

        @Transactional(readOnly = true)
        public List<InterviewSessionResponse> getUserSessions(Long userId) {
                return sessionRepository.findByUserIdOrderByStartTimeDesc(userId)
                                .stream()
                                .map(this::toResponse)
                                .collect(Collectors.toList());
        }

        @Transactional
        public InterviewerProfileResponse upsertInterviewerProfile(Long interviewerId,
                        CreateInterviewerProfileRequest request) {
                User interviewer = userRepository.findById(interviewerId)
                                .orElseThrow(() -> new RuntimeException("Interviewer not found"));
                if (interviewer.getRole() != Role.INTERVIEWER) {
                        throw new RuntimeException("Only interviewer accounts can update interviewer profile");
                }

                InterviewerProfile profile = interviewerProfileRepository.findByUserId(interviewerId)
                                .orElse(InterviewerProfile.builder().user(interviewer).build());

                profile.setHeadline(request.getHeadline());
                profile.setBio(request.getBio());
                profile = interviewerProfileRepository.save(profile);

                return mapInterviewerProfile(profile);
        }

        @Transactional(readOnly = true)
        public InterviewerProfileResponse getInterviewerProfile(Long interviewerId) {
                User interviewer = userRepository.findById(interviewerId)
                                .orElseThrow(() -> new RuntimeException("Interviewer not found"));
                InterviewerProfile profile = interviewerProfileRepository.findByUserId(interviewerId)
                                .orElse(InterviewerProfile.builder().user(interviewer).build());
                return mapInterviewerProfile(profile);
        }

        @Transactional(readOnly = true)
        public List<InterviewerProfileResponse> getInterviewerProfiles() {
                return userRepository.findByRoleOrderByNameAsc(Role.INTERVIEWER)
                                .stream()
                                .map(interviewer -> {
                                        InterviewerProfile profile = interviewerProfileRepository
                                                        .findByUserId(interviewer.getId())
                                                        .orElse(InterviewerProfile.builder().user(interviewer).build());
                                        return mapInterviewerProfile(profile);
                                })
                                .collect(Collectors.toList());
        }

        @Transactional
        public InterviewAvailabilitySlotResponse createAvailabilitySlot(Long interviewerId,
                        CreateAvailabilitySlotRequest request) {
                User interviewer = userRepository.findById(interviewerId)
                                .orElseThrow(() -> new RuntimeException("Interviewer not found"));
                if (interviewer.getRole() != Role.INTERVIEWER) {
                        throw new RuntimeException("Only interviewer accounts can create slots");
                }

                if (request.getStartTime() == null || request.getEndTime() == null ||
                                !request.getEndTime().isAfter(request.getStartTime())) {
                        throw new RuntimeException("Invalid slot time range");
                }
                if (request.getGoogleMeetLink() == null
                                || !request.getGoogleMeetLink().startsWith("https://meet.google.com/")) {
                        throw new RuntimeException("Google Meet link must start with https://meet.google.com/");
                }

                InterviewAvailabilitySlot slot = InterviewAvailabilitySlot.builder()
                                .interviewer(interviewer)
                                .startTime(request.getStartTime())
                                .endTime(request.getEndTime())
                                .googleMeetLink(request.getGoogleMeetLink())
                                .booked(false)
                                .build();

                slot = slotRepository.save(slot);
                return mapSlot(slot);
        }

        @Transactional(readOnly = true)
        public List<InterviewAvailabilitySlotResponse> getAvailableSlots(Long interviewerId) {
                return slotRepository.findByInterviewerIdAndBookedFalseOrderByStartTimeAsc(interviewerId)
                                .stream()
                                .map(this::mapSlot)
                                .collect(Collectors.toList());
        }

        @Transactional(readOnly = true)
        public List<InterviewAvailabilitySlotResponse> getInterviewerSlots(Long interviewerId) {
                return slotRepository.findByInterviewerIdOrderByStartTimeAsc(interviewerId)
                                .stream()
                                .map(this::mapSlot)
                                .collect(Collectors.toList());
        }

        @Transactional
        public SessionQuestion askNextQuestion(Long sessionId, String topic) {
                InterviewSession session = sessionRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Session not found"));

                if (session.getMode() == InterviewMode.HUMAN) {
                        throw new RuntimeException("AI question flow is not available for HUMAN interviews");
                }

                String activeTopic = topic == null || topic.isBlank()
                                ? resolveTopic(session, (int) logRepository.countBySessionId(sessionId))
                                : topic.trim();

                List<String> recentQuestions = questionRepository.findTop5BySessionIdOrderByIdDesc(sessionId)
                                .stream()
                                .map(SessionQuestion::getQuestionText)
                                .collect(Collectors.toList());

                String prompt = String.format(
                                "You are a %s interviewer for a %s position at %s. " +
                                                "Mood: %s. Candidate context: '%s'. " +
                                                "Ask exactly one unique, concise interview question about %s. " +
                                                "Do not repeat any of these recent questions: %s. " +
                                                "Keep the question varied, practical, and different from earlier ones.",
                                session.getTargetProfile().getRoleName(),
                                session.getTargetProfile().getRoleName(),
                                session.getTargetProfile().getCompanyName(),
                                session.getInterviewerPersona() != null ? session.getInterviewerPersona().getBaseMood()
                                                : "Medium",
                                session.getResumeText() != null ? session.getResumeText() : "None provided",
                                activeTopic,
                                recentQuestions.isEmpty() ? "none" : String.join(" | ", recentQuestions));

                String aiQuestionText = chatClient.prompt()
                                .user(prompt)
                                .call()
                                .content();

                logRepository.save(InterviewLog.builder()
                                .session(session)
                                .role("question")
                                .content(aiQuestionText)
                                .timestamp(LocalDateTime.now())
                                .build());

                SessionQuestion question = SessionQuestion.builder()
                                .session(session)
                                .topic(activeTopic)
                                .questionText(aiQuestionText)
                                .build();

                return questionRepository.save(question);
        }

        @Transactional
        public SessionQuestion evaluateAnswer(Long questionId, EvaluateAnswerRequest request) {
                SessionQuestion question = questionRepository.findById(questionId)
                                .orElseThrow(() -> new RuntimeException("Question not found"));

                if (question.getSession().getMode() == InterviewMode.HUMAN) {
                        throw new RuntimeException("AI evaluation is not available for HUMAN interviews");
                }

                question.setUserAnswer(request.getUserAnswer());

                logRepository.save(InterviewLog.builder()
                                .session(question.getSession())
                                .role("response")
                                .content(request.getUserAnswer())
                                .timestamp(LocalDateTime.now())
                                .build());

                String prompt = String.format(
                                "The candidate was asked: '%s'. They answered: '%s'. " +
                                                "Current posture feedback: '%s'. " +
                                                "Provide a brief evaluation of technical depth, structure, posture, and communication. "
                                                +
                                                "Return the feedback in this exact format: " +
                                                "Semantic Accuracy: <0-100>\n" +
                                                "Technical Depth: <0-100>\n" +
                                                "Conversational Clarity: <0-100>\n" +
                                                "Visual Focus: <0-100>\n" +
                                                "Postural Stability: <0-100>\n" +
                                                "Summary: <actionable feedback>.",
                                question.getQuestionText(),
                                request.getUserAnswer(),
                                request.getPostureFeedback() != null ? request.getPostureFeedback() : "Not available");

                String aiEvaluation = chatClient.prompt()
                                .user(prompt)
                                .call()
                                .content();

                logRepository.save(InterviewLog.builder()
                                .session(question.getSession())
                                .role("evaluation")
                                .content(aiEvaluation)
                                .timestamp(LocalDateTime.now())
                                .build());

                question.setAiResponse(aiEvaluation);
                return questionRepository.save(question);
        }

        @Transactional(readOnly = true)
        public List<InterviewLogResponse> getInterviewLogs(Long sessionId) {
                return logRepository.findBySessionIdOrderByTimestampAsc(sessionId)
                                .stream()
                                .map(log -> InterviewLogResponse.builder()
                                                .id(log.getId())
                                                .role(log.getRole())
                                                .content(log.getContent())
                                                .timestamp(log.getTimestamp())
                                                .build())
                                .collect(Collectors.toList());
        }

        @Transactional
        public InterviewSessionResponse endSession(Long sessionId) {
                InterviewSession session = sessionRepository.findById(sessionId)
                                .orElseThrow(() -> new RuntimeException("Session not found"));

                if (session.getEndTime() != null) {
                        return getSession(sessionId);
                }

                if (session.getMode() == InterviewMode.HUMAN) {
                        session.setEndTime(LocalDateTime.now());
                        sessionRepository.save(session);
                        return getSession(sessionId);
                }

                List<InterviewLog> logs = logRepository.findBySessionIdOrderByTimestampAsc(sessionId);
                String transcript = logs.stream()
                                .map(log -> String.format("%s: %s", capitalize(log.getRole()), log.getContent()))
                                .collect(Collectors.joining("\n"));

                String finalPrompt = String.format(
                                "Review this interview transcript and provide a final evaluation with strengths, gaps, posture notes, and next steps. "
                                                +
                                                "Return the response in this exact format: " +
                                                "Semantic Accuracy: <0-100>\n" +
                                                "Technical Depth: <0-100>\n" +
                                                "Conversational Clarity: <0-100>\n" +
                                                "Visual Focus: <0-100>\n" +
                                                "Postural Stability: <0-100>\n" +
                                                "Final Score: <0-100>\n" +
                                                "Performance Level: <EXCELLENT|GOOD|AVERAGE|NEEDS IMPROVEMENT>\n" +
                                                "Summary: <short narrative with strengths, gaps, and next steps>.\n\nTranscript:\n%s",
                                transcript);

                String finalEvaluation = chatClient.prompt()
                                .user(finalPrompt)
                                .call()
                                .content();

                logRepository.save(InterviewLog.builder()
                                .session(session)
                                .role("final")
                                .content(finalEvaluation)
                                .timestamp(LocalDateTime.now())
                                .build());

                session.setEndTime(LocalDateTime.now());
                sessionRepository.save(session);

                return getSession(sessionId);
        }

        private String resolveTopic(InterviewSession session, int questionCount) {
                List<String> topics = Arrays.stream(
                                (session.getRoundTypes() == null || session.getRoundTypes().isBlank())
                                                ? new String[] { "Technical", "Behavioral", "System Design" }
                                                : session.getRoundTypes().split(","))
                                .map(String::trim)
                                .filter(topic -> !topic.isBlank())
                                .collect(Collectors.toList());

                if (topics.isEmpty()) {
                        topics = List.of("Technical", "Behavioral", "System Design");
                }

                int topicIndex = Math.max(questionCount, 0) / QUESTIONS_PER_TOPIC;
                return topics.get(topicIndex % topics.size());
        }

        private String capitalize(String value) {
                if (value == null || value.isBlank()) {
                        return "Log";
                }
                return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1);
        }

        private InterviewSessionResponse toResponse(InterviewSession session) {
                String mood = session.getInterviewerPersona() != null
                                ? session.getInterviewerPersona().getBaseMood()
                                : "Human";

                return InterviewSessionResponse.builder()
                                .id(session.getId())
                                .companyName(session.getTargetProfile().getCompanyName())
                                .position(session.getTargetProfile().getRoleName())
                                .roundTypes(session.getRoundTypes())
                                .mood(mood)
                                .mode(session.getMode() != null ? session.getMode().name() : InterviewMode.AI.name())
                                .startTime(session.getStartTime())
                                .endTime(session.getEndTime())
                                .scheduledAt(session.getScheduledAt())
                                .durationMinutes(session.getDurationMinutes())
                                .resumeText(session.getResumeText())
                                .interviewerName(session.getInterviewerUser() != null
                                                ? session.getInterviewerUser().getName()
                                                : null)
                                .interviewerEmail(session.getInterviewerUser() != null
                                                ? session.getInterviewerUser().getEmail()
                                                : null)
                                .meetingLink(session.getExternalMeetingLink())
                                .build();
        }

        private InterviewerProfileResponse mapInterviewerProfile(InterviewerProfile profile) {
                return InterviewerProfileResponse.builder()
                                .interviewerId(profile.getUser().getId())
                                .name(profile.getUser().getName())
                                .email(profile.getUser().getEmail())
                                .headline(profile.getHeadline())
                                .bio(profile.getBio())
                                .build();
        }

        private InterviewAvailabilitySlotResponse mapSlot(InterviewAvailabilitySlot slot) {
                return InterviewAvailabilitySlotResponse.builder()
                                .slotId(slot.getId())
                                .interviewerId(slot.getInterviewer().getId())
                                .interviewerName(slot.getInterviewer().getName())
                                .startTime(slot.getStartTime())
                                .endTime(slot.getEndTime())
                                .googleMeetLink(slot.getGoogleMeetLink())
                                .booked(slot.getBooked())
                                .build();
        }
}
