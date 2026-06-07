# Project Description
The project is a comprehensive Interview Preparation and Learning Roadmap tracking platform. It enables learners to generate personalized daily learning plans for target roles and companies, track momentum against a "Ghost Performance" benchmark, and practice through interview simulations. The platform now supports both AI interviews and human interviewer scheduling using Google Meet links, with role-aware user experiences for learners and interviewers.

## Completed / In Progress

**Backend (Completed / Advanced Progress):**
- **Core Domain Models:** Implemented major entities including `User`, `TargetProfile`, `Roadmap`, `RoadmapTopic`, `GhostPerformance`, `InterviewSession`, `InterviewLog`, `FocusAlert`, and persona strategy classes (`Friendly`, `Medium`, `Strict`).
- **Interviewer Expansion:** Added support for `INTERVIEWER` role, human interview mode, interviewer profile management, and interviewer availability slots.
- **Roadmap Persistence Fix:** Resolved roadmap subtopic ordering persistence issue by aligning model fields with DB constraints (`sequenceOrder` support for subtopics).
- **Service Layer:** Active business logic in `AuthService`, `RoadmapService`, `GhostService`, `InterviewSimulationService`, and `FocusAnalyticsService`.
- **API Endpoints:** Functional REST controllers for auth, roadmap generation/tracking, ghost synchronization, interview flows, interviewer slot/profile management, and interview history.
- **Authentication & Security:** JWT-based stateless auth with improved handling for malformed/stale token scenarios on public flows.
- **Schema Compatibility Update:** Added startup schema correction for role-column length compatibility to support expanded role values.

**Frontend (Completed / Advanced Progress):**
- **Foundation & Routing:** React + TypeScript app with protected routing and dashboard navigation.
- **Authentication Views:** Working login and register pages with role selection (`USER`, `INTERVIEWER`).
- **Roadmap UX:** Setup/list/detail roadmap components with enhanced flow visualization and themed UI refinements.
- **Interview UX:** AI interview experience with log views plus human interview booking flow.
- **Interviewer UX:** Interviewer-focused dashboard/actions, slot creation/management, and slot-history view.
- **Role-Based Navigation:** Roadmap surfaces are hidden for interviewer accounts in dashboard/top-nav contexts.
- **Advanced Ghost Analytics UI:** Richer time-series and comparative visualizations for ghost pacing remain pending.(kinda done)

## Not Implemented / Planned Features

- **Comprehensive Testing:** Broader unit, integration, and E2E coverage is still needed across backend and frontend.
- **Hardware Focus Tracking:** Full client-side CV-based focus tracking remains partially integrated.
- **CI/CD Hardening:** Automated pipelines for lint, test, build, and deployment are not fully mature.
- **Operational Observability:** Centralized metrics/tracing and structured alerting can be further improved.

## Known Issues / Recent Stabilizations

- **Role Schema Drift (Resolved):** Registration failures for interviewer accounts were caused by DB column sizing mismatch for role values.
- **Auth Validation Edge Case (Resolved):** Token interceptor/public route behavior around `/auth/me` caused session validation issues until corrected.
- **Cross-Surface Role Gating (Stabilized):** Role-specific visibility required updates in multiple UI locations (dashboard, history, top navigation).

---

## Appendix: Core Project UML Diagram
UML diagram
@startuml

skinparam classAttributeIconSize 0
skinparam linetype ortho
hide empty methods

enum Role {
  USER
  INTERVIEWER
  ADMIN
}

enum InterviewMode {
  AI
  HUMAN
}

class User {
  - name: String
  - email: String {unique}
  - password: String
  - role: Role
  - experienceLevel: String
  + getAuthorities(): Collection
  + isAccountNonExpired(): boolean
}

class InterviewerProfile {
  - userId: Long {unique}
  - headline: String
  - yearsOfExperience: Integer
  - expertiseTags: String
  - about: String
}

class InterviewAvailabilitySlot {
  - interviewerId: Long
  - startTime: LocalDateTime
  - endTime: LocalDateTime
  - googleMeetLink: String
  - booked: Boolean
}

class TargetProfile {
  - roleName: String
  - companyName: String
  - targetDate: LocalDate
  - dailyHourLimit: Double
  - maxDailyThreshold: Double
}

class Roadmap {
  - createdAt: LocalDateTime {readOnly}
  - startDate: LocalDate
  - endDate: LocalDate
  + calculateRequiredVelocity(): Double
  + rebalanceRoadmap(): void
}

class RoadmapTopic {
  - title: String {unique}
  - priority: String
  - estimatedHours: Double
  - isCompleted: Boolean
  - sequenceOrder: Integer {ordered}
  + markAsComplete(): void
}

class Subtopic <<Value Object>> {
  - title: String {unique}
  - isCompleted: Boolean
  - sequenceOrder: Integer
}

class GhostPerformance {
  - lastSyncedTopicIndex: Integer
  - initialFixedVelocity: Double
  + syncPosition(userPace: Double): void
}

abstract class InterviewerPersona {
  - baseMood: String
  - followUpDepth: Integer
  + generatePrompt(context: String): String
}

class StrictPersona
class MediumPersona
class FriendlyPersona

class InterviewSession {
  - mode: InterviewMode
  - startTime: LocalDateTime
  - endTime: LocalDateTime
  - scheduledStartTime: LocalDateTime
  - scheduledEndTime: LocalDateTime
  - meetingLink: String
  - techScore: Double {0 <= value <= 100}
  - focusScore: Double {0 <= value <= 100}
  + calculateOverallScore(): Double
  + concludeSession(): void
}

class InterviewLog {
  - role: String
  - content: String
  - timestamp: LocalDateTime
}

class FocusAlert {
  - alertType: String
  - timestamp: LocalDateTime
}

' Relationships
User --> Role : has
User "1" o-- "0..*" TargetProfile : manages
User "1" --> "0..*" InterviewSession : attempts
User "1" -- "0..1" InterviewerProfile : owns
User "1" -- "0..*" InterviewAvailabilitySlot : publishes

InterviewSession --> InterviewMode : uses
InterviewSession "0..*" --> "0..1" User : interviewer

TargetProfile "1" *-- "1" Roadmap : generates
Roadmap "1" -- "1.." RoadmapTopic : contains
Roadmap "1" *-- "1" GhostPerformance : benchmark
RoadmapTopic "1" -- "0.." Subtopic : includes

InterviewSession "1" --> "1" TargetProfile : tests
InterviewSession "1" --> "0..1" InterviewerPersona : uses for AI mode
InterviewSession "1" -- "0.." InterviewLog : logs
InterviewSession "1" -- "0.." FocusAlert : alerts

InterviewerPersona <|-- StrictPersona
InterviewerPersona <|-- MediumPersona
InterviewerPersona <|-- FriendlyPersona

' Constraints
note right of InterviewerPersona
  {disjoint, complete}
end note

note right of RoadmapTopic
  {ordered by sequenceOrder}
end note

note right of InterviewSession
  {endTime > startTime}
end note

note right of InterviewSession
  {mode = HUMAN implies meetingLink and schedule required}
end note

@enduml


## Appendix: Core Project Use Case Diagram
![alt text](useCase.png)