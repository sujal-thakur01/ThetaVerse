# ThetaVerse Project Learning Guide (Brief)

## 1) What this project is

ThetaVerse is an interview-prep platform with:

- JWT auth and role-based access (USER / INTERVIEWER)
- AI mock interviews (question generation + evaluation)
- Human live interview room (WebSocket signaling + WebRTC media)
- AI-generated learning roadmaps with progress tracking
- Ghost pace analytics (your progress vs expected pace)

Tech stack:

- Backend: Spring Boot, Spring Security, Spring Data JPA, Spring AI, MySQL, WebSocket
- Frontend: React + TypeScript + Vite + Tailwind + Axios

---

## 2) High-level folder map

### Root

- `ProjectDescription.md`: project intent, implemented/pending notes, UML.
- `backend/`: Java Spring Boot backend.
- `frontend/`: React frontend app.
- `fix_test.sh`, `fix_ui.sh`, `ws_test.*`: helper scripts/tests.

### Backend (`backend/src/main/java/com/interview/backend`)

- `controller/`: REST and WebSocket entry points.
- `service/`: business logic.
- `entity/`: JPA domain models.
- `repository/`: Spring Data repositories.
- `config/`: security, JWT filter, websocket registration, AI config.

### Frontend (`frontend/src`)

- `AppRouter.tsx`: all route wiring.
- `contextApi/ContextApi.tsx`: auth/session context and current user.
- `api/apiClient.ts`: axios client + token interceptor.
- `components/`: feature UI screens.
- `hooks/useLiveSession.ts`: core WebSocket + WebRTC call/session logic.

---

## 3) Backend features and where logic lives

### A) Authentication and authorization

Files:

- `controller/AuthController.java`
- `service/AuthService.java`
- `service/JwtService.java`
- `config/SecurityConfig.java`
- `config/JwtAuthenticationFilter.java`
- `entity/User.java`, `entity/Role.java`

Implemented logic:

- Register/login returns JWT token.
- Role parsing and validation (ADMIN self-registration blocked).
- `/api/auth/me` returns current logged-in user from JWT principal.
- Stateless security; most non-auth routes require token.

### B) AI interview simulation

Files:

- `controller/InterviewController.java`
- `service/InterviewSimulationService.java`
- `entity/InterviewSession.java`, `entity/SessionQuestion.java`, `entity/InterviewLog.java`
- `entity/InterviewerPersona.java` + `FriendlyPersona.java`, `MediumPersona.java`, `StrictPersona.java`

Implemented logic:

- Start AI session with company/position/mood/round types/resume text.
- Generate next question via Spring AI (`ChatClient`) with anti-repeat context.
- Evaluate candidate answer (technical + structure + posture context).
- Persist full transcript logs (`question`, `response`, `evaluation`, `final`).
- End session triggers final AI summary for AI mode.

### C) Human interviewer workflow (booked interview)

Files:

- `controller/InterviewerController.java`
- `controller/InterviewController.java` (`/book-human`)
- `service/InterviewSimulationService.java`
- `entity/InterviewerProfile.java`, `entity/InterviewAvailabilitySlot.java`, `entity/InterviewMode.java`

Implemented logic:

- Interviewer profile upsert/get.
- Interviewer slot creation with validations:
  - valid start/end window
  - Google Meet link format check
- Student can book slot (marks slot booked and creates HUMAN interview session).

### D) Live session room (real-time)

Files:

- `controller/LiveSessionController.java` (create/validate/debug session)
- `controller/SignalingHandler.java` (WebSocket message router)
- `service/LiveSessionService.java` (in-memory room state)
- `config/WebSocketConfig.java`

Implemented logic:

- Host creates room and gets session code + host id.
- Student joins as WAITING; host can ADMIT/REJECT/REMOVE.
- Capacity control (1..5 admitted students).
- Signaling rules enforced: only host <-> admitted student.
- Host media permission broadcast (camera/audio/screen visibility controls).
- Disconnect handling with grace period and cleanup.

### E) Roadmap generation and tracking

Files:

- `controller/RoadmapController.java`
- `service/RoadmapService.java`
- `service/DailyTaskService.java`
- `entity/Roadmap.java`, `RoadmapTopic.java`, `Subtopic.java`, `DailyTask.java`, `TargetProfile.java`

Implemented logic:

- Generate roadmap from user target inputs (company/role/topic/time budget).
- Uses Spring AI to produce topics + subtopics + reference links.
- Fallback topic creation if AI parse fails.
- Mark topic/subtopic complete.
- Schedule tasks over available days until target date.

### F) Ghost pace analytics

Files:

- `controller/GhostController.java`
- `service/GhostService.java`
- `entity/GhostPerformance.java`

Implemented logic:

- Ghost initialized per roadmap with computed velocity.
- Ghost score = expected topic progress over elapsed days.
- Compare against user completed topics (`isBehind` output).

### G) Focus analytics

Files:

- `controller/FocusController.java`
- `service/FocusAnalyticsService.java`
- `entity/FocusSession.java`, `FocusAlert.java`

Implemented logic:

- Start focus session per interview session.
- Record distraction alerts (adds distraction duration).
- Compute final focus score.

---

## 4) Frontend feature map

### Routing and access

- `AppRouter.tsx`: all page routes.
- `PrivateRoute.tsx`: public/private gating by auth state.
- `contextApi/ContextApi.tsx`: token persistence + `/auth/me` validation.

### Auth

- `components/LoginPage.tsx`, `components/RegisterPage.tsx`
- stores token and navigates to dashboard.

### Dashboard and role-aware UX

- `components/Dashboard/DashboardLayout.tsx`
- interviewer sees slot metrics; user sees learner-oriented actions.

### Interview flow UI

- Setup: `components/Dashboard/InterviewSetup.tsx`
- Session UI: `components/Dashboard/InterviewUI.tsx`
- Logs dashboard: `components/Dashboard/InterviewLogDashboard.tsx`
- History: `components/Dashboard/InterviewHistory.tsx`

Implemented UI behavior:

- AI interview start, ask/evaluate/end flow.
- Voice synthesis for AI text + speech recognition for candidate input.
- Basic posture signal via MediaPipe pose.
- Interview logs and final summary view.

### Roadmap UI

- Setup: `components/Dashboard/RoadmapSetup.tsx`
- Roadmap list: `components/Dashboard/UserRoadmaps.tsx`
- Detail/progress/ghost race: `components/Dashboard/RoadmapUI.tsx`

### Live interview UI

- `components/live/LiveSetup.tsx`
- `components/live/InterviewerDashboard.tsx`
- `components/live/StudentSession.tsx`
- core logic: `hooks/useLiveSession.ts`

Implemented UI behavior:

- Host controls participant admission and room capacity.
- WebRTC offer/answer/ICE handling.
- Student waiting/admitted/rejected states.
- Host-controlled media visibility.

---

## 5) Important runtime/config files

- `backend/src/main/resources/application.properties`
  - MySQL datasource
  - Spring AI provider config (Groq/OpenAI compatible endpoint)
  - JWT secret and expiration
- `backend/pom.xml`
  - Spring Boot + Security + JPA + WebSocket + Spring AI dependencies
- `frontend/package.json`
  - Vite/React build scripts and UI dependencies

---

## 6) Notes you should know quickly

- `LiveSessionService` stores active rooms in memory (not DB-persisted).
- Some helper methods in `frontend/src/api/apiClient.ts` are older-style wrappers; most screens directly call `apiClient` with current endpoints.
- Roadmap and interview AI generation rely on configured API key/environment variables.

---

## 7) If you want to learn this project fast (recommended order)

1. Read `frontend/src/AppRouter.tsx` to understand all user flows.
2. Read backend controllers to see endpoint surface.
3. Read matching services (`InterviewSimulationService`, `RoadmapService`, `LiveSessionService`) for core logic.
4. Read `useLiveSession.ts` for the most complex frontend real-time logic.
5. Read `ProjectDescription.md` for product-level context.
