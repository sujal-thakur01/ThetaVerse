package com.interview.backend.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interview.backend.dto.BookHumanInterviewRequest;
import com.interview.backend.dto.EvaluateAnswerRequest;
import com.interview.backend.dto.InterviewLogResponse;
import com.interview.backend.dto.InterviewSessionResponse;
import com.interview.backend.entity.InterviewSession;
import com.interview.backend.entity.SessionQuestion;
import com.interview.backend.service.InterviewSimulationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/interviews")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InterviewController {

    private final InterviewSimulationService interviewService;

    @PostMapping("/start")
    public ResponseEntity<InterviewSession> startSession(@RequestBody StartInterviewRequest request) {
        InterviewSession session = interviewService.startSession(request);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/book-human")
    public ResponseEntity<InterviewSession> bookHumanInterview(@RequestBody BookHumanInterviewRequest request) {
        InterviewSession session = interviewService.bookHumanInterview(request);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<InterviewSessionResponse> getSession(@PathVariable Long sessionId) {
        return ResponseEntity.ok(interviewService.getSession(sessionId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<InterviewSessionResponse>> getUserSessions(@PathVariable Long userId) {
        return ResponseEntity.ok(interviewService.getUserSessions(userId));
    }

    @PostMapping("/{sessionId}/question")
    public ResponseEntity<SessionQuestion> askNextQuestion(
            @PathVariable Long sessionId,
            @RequestParam String topic) {

        SessionQuestion question = interviewService.askNextQuestion(sessionId, topic);
        return ResponseEntity.ok(question);
    }

    @PostMapping("/question/{questionId}/evaluate")
    public ResponseEntity<SessionQuestion> evaluateAnswer(
            @PathVariable Long questionId,
            @RequestBody EvaluateAnswerRequest request) {

        SessionQuestion evaluatedQuestion = interviewService.evaluateAnswer(questionId, request);
        return ResponseEntity.ok(evaluatedQuestion);
    }

    @PostMapping("/{sessionId}/end")
    public ResponseEntity<InterviewSessionResponse> endSession(@PathVariable Long sessionId) {
        return ResponseEntity.ok(interviewService.endSession(sessionId));
    }

    @GetMapping("/{sessionId}/logs")
    public ResponseEntity<List<InterviewLogResponse>> getLogs(@PathVariable Long sessionId) {
        return ResponseEntity.ok(interviewService.getInterviewLogs(sessionId));
    }
}
