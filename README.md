<div align="center">

# 🎯 ThetaVerse — AI-Powered Interview Preparation Platform

**Master your interviews with AI-driven simulations, ghost benchmarking, and personalized roadmaps.**

[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F?style=for-the-badge&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Live-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://docs.spring.io/spring-framework/reference/web/websocket.html)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

</div>

---

## 🎬 Demo

<!-- Replace the link below with your actual demo video or GIF -->
> 🚧 **Demo video coming soon!** A walkthrough video will be added here showcasing the full platform in action.

<!--
[![ThetaVerse Demo](https://img.youtube.com/vi/YOUR_VIDEO_ID/maxresdefault.jpg)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
-->

---

## ✨ Key Features

### 🤖 AI Interview Simulation
Practice with AI-powered interviewers that adapt to your level. Choose from three distinct personas powered by **Groq LLM**:

| Persona | Style | Best For |
|---------|-------|----------|
| 🔴 **Strict** | Challenging, minimal hints, high-pressure | Senior-level prep, FAANG-style interviews |
| 🟡 **Medium** | Balanced feedback, moderate follow-ups | Mid-level interview practice |
| 🟢 **Friendly** | Encouraging, detailed guidance | Beginners, confidence building |

### 👻 Ghost Performance Benchmarking
Race against a **ghost benchmark** that tracks ideal study velocity. Visualize your progress against the optimal pace to stay on track with your preparation goals.

### 🗺️ Personalized Learning Roadmap
AI-generated daily learning plans tailored to your **target role**, **company**, and **timeline**. Topics are sequenced and prioritized with subtopic breakdowns and completion tracking.

### 📅 Human Interviewer Scheduling
Book sessions with real interviewers through the platform. Interviewers publish availability slots with **Google Meet** links for seamless video interview sessions.

### ⚡ WebSocket Live Sessions
Real-time interview sessions powered by WebSocket connections, enabling instant message exchange between candidates and AI/human interviewers.

### 🔐 JWT Authentication
Stateless, secure authentication with role-based access control (`USER`, `INTERVIEWER`, `ADMIN`). Protected routes ensure proper authorization across the platform.

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript | SPA with component-based architecture |
| **Styling** | Tailwind CSS 4 | Utility-first responsive design |
| **Build Tool** | Vite 7 | Lightning-fast HMR and bundling |
| **Backend** | Spring Boot 3 (Java) | REST API + WebSocket server |
| **Security** | Spring Security + JWT | Stateless auth with role gating |
| **Database** | MySQL 8 | Persistent relational storage |
| **ORM** | Hibernate / JPA | Auto-schema generation via `ddl-auto=update` |
| **AI Engine** | Groq LLM (OpenAI-compatible) | Interview simulation & roadmap generation |
| **Real-time** | Spring WebSocket (STOMP) | Live interview sessions |
| **HTTP Client** | Axios | Frontend API communication |
| **Routing** | React Router 7 | Client-side navigation & protected routes |

---

## 📁 Project Structure

```
ThetaVerse/
├── backend/                          # Spring Boot application
│   ├── pom.xml                       # Maven dependencies
│   ├── mvnw / mvnw.cmd              # Maven wrapper scripts
│   └── src/
│       ├── main/
│       │   ├── java/com/interview/backend/
│       │   │   ├── BackendApplication.java
│       │   │   ├── config/           # Security, JWT, WebSocket, AI configs
│       │   │   ├── controller/       # REST & WebSocket controllers
│       │   │   ├── dto/              # Data transfer objects
│       │   │   ├── entity/           # JPA entities (User, Roadmap, Interview, etc.)
│       │   │   ├── repository/       # Spring Data JPA repositories
│       │   │   └── service/          # Business logic layer
│       │   └── resources/
│       │       ├── application.properties
│       │       └── schema.sql
│       └── test/                     # Unit & integration tests
│
├── frontend/                         # React + TypeScript application
│   ├── index.html                    # Entry HTML
│   ├── package.json                  # NPM dependencies
│   ├── vite.config.ts                # Vite configuration
│   ├── tsconfig.json                 # TypeScript config
│   └── src/
│       ├── main.tsx                  # App entry point
│       ├── App.tsx                   # Root component
│       ├── AppRouter.tsx             # Route definitions
│       ├── PrivateRoute.tsx          # Auth-protected route wrapper
│       ├── api/                      # Axios API client
│       ├── components/
│       │   ├── Dashboard/            # Interview, Roadmap, Ghost UIs
│       │   ├── live/                 # Live session components
│       │   ├── LandingPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   └── NavBar.tsx
│       ├── contextApi/               # React context providers
│       ├── hooks/                    # Custom hooks (useLiveSession)
│       └── utils/                    # Utility functions
│
├── ai-validation/                    # AI output validation suite
│   └── roadmap/                      # Roadmap quality validation scripts
│
├── .gitignore
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- **Java 17+** (JDK)
- **Node.js 18+** and **npm**
- **MySQL 8.0+**
- **Maven 3.9+** (or use the included `mvnw` wrapper)

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/sujal-thakur01/ThetaVerse.git
cd ThetaVerse
```

### 2️⃣ Backend Setup (Spring Boot + Maven)

```bash
cd backend
```

**Configure environment variables** (create a `.env` file or export directly):

```bash
export SQL_PASSWORD=your_mysql_root_password
export GROQ_API_KEY=your_groq_api_key
export JWT_SECRET=your_jwt_secret_key_min_256_bits
```

**Run the backend:**

```bash
# Using Maven wrapper (recommended)
./mvnw spring-boot:run

# Or with system Maven
mvn spring-boot:run
```

The backend starts on **`http://localhost:8080`** by default.

### 3️⃣ Frontend Setup (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **`http://localhost:5173`** by default.

### 4️⃣ Access the Platform

Open your browser and navigate to `http://localhost:5173`. Register a new account and start preparing!

---

## 🗄️ Database

ThetaVerse uses **MySQL** as its primary database. The schema is **auto-generated** by Hibernate on application startup via `spring.jpa.hibernate.ddl-auto=update`.

**Database details:**

| Property | Value |
|----------|-------|
| Database Name | `interview_prep_db` |
| Auto-creation | ✅ `createDatabaseIfNotExist=true` |
| Schema Management | Hibernate `ddl-auto=update` |
| Initial Data | `schema.sql` runs on startup |

> **Note:** Ensure your MySQL server is running on `localhost:3306` before starting the backend. The database and all tables will be created automatically on first run.

---

## 🧪 Running Tests

```bash
# Backend tests
cd backend
./mvnw test

# Frontend lint
cd frontend
npm run lint
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Sujal Thakur](https://github.com/sujal-thakur01)**

</div>
