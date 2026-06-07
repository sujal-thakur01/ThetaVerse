import { Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/NavBar";
import ShortenUrlPage from "./components/ShortenUrlPage";
import { Toaster } from "react-hot-toast";
import Footer from "./components/Footer";
import LandingPage from "./components/LandingPage";
import AboutPage from "./components/AboutPage";
import RegisterPage from "./components/RegisterPage";
import LoginPage from "./components/LoginPage";
import DashboardLayout from "./components/Dashboard/DashboardLayout";
import PrivateRoute from "./PrivateRoute";
import ErrorPage from "./components/ErrorPage";
import InterviewSetup from "./components/Dashboard/InterviewSetup";
import InterviewUI from "./components/Dashboard/InterviewUI";
import InterviewLogDashboard from "./components/Dashboard/InterviewLogDashboard";
import InterviewHistory from "./components/Dashboard/InterviewHistory";
import RoadmapSetup from "./components/Dashboard/RoadmapSetup";
import RoadmapUI from "./components/Dashboard/RoadmapUI";
import UserRoadmaps from "./components/Dashboard/UserRoadmaps";
import { logExecution } from "./utils/executionLogger";
import LiveSetup from "./components/live/LiveSetup";
import InterviewerDashboard from "./components/live/InterviewerDashboard";
import StudentSession from "./components/live/StudentSession";

const AppRouter = () => {
  const location = useLocation();
  const hideHeaderFooter = location.pathname.startsWith("/s");

  useEffect(() => {
    logExecution("AppRouter", "route changed", { path: location.pathname });
  }, [location.pathname]);

  return (
    <>
      {!hideHeaderFooter && <Navbar />}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#171717",
            color: "#fff",
            border: "1px solid #262626",
          },
        }}
      />
      <Routes>
        <Route
          path="/"
          element={
            <PrivateRoute publicPage={false}>
              <LandingPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/about"
          element={
            <PrivateRoute publicPage={false}>
              <AboutPage />
            </PrivateRoute>
          }
        />
        <Route path="/s/:url" element={<ShortenUrlPage />} />

        <Route
          path="/register"
          element={
            <PrivateRoute publicPage={true}>
              <RegisterPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PrivateRoute publicPage={true}>
              <LoginPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute publicPage={false}>
              <DashboardLayout />
            </PrivateRoute>
          }
        />
        <Route
          path="/interview/setup"
          element={
            <PrivateRoute publicPage={false}>
              <InterviewSetup />
            </PrivateRoute>
          }
        />
        <Route
          path="/interview/:sessionId"
          element={
            <PrivateRoute publicPage={false}>
              <InterviewUI />
            </PrivateRoute>
          }
        />
        <Route
          path="/interview/logs/:sessionId"
          element={
            <PrivateRoute publicPage={false}>
              <InterviewLogDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/interview/history"
          element={
            <PrivateRoute publicPage={false}>
              <InterviewHistory />
            </PrivateRoute>
          }
        />
        <Route
          path="/roadmap/setup"
          element={
            <PrivateRoute publicPage={false}>
              <RoadmapSetup />
            </PrivateRoute>
          }
        />
        <Route
          path="/roadmap/user"
          element={
            <PrivateRoute publicPage={false}>
              <UserRoadmaps />
            </PrivateRoute>
          }
        />
        <Route
          path="/roadmap/:roadmapId"
          element={
            <PrivateRoute publicPage={false}>
              <RoadmapUI />
            </PrivateRoute>
          }
        />
        <Route
          path="/live/setup"
          element={
            <PrivateRoute publicPage={false}>
              <LiveSetup />
            </PrivateRoute>
          }
        />
        <Route
          path="/live/host/:hostId/:sessionCode"
          element={
            <PrivateRoute publicPage={false}>
              <InterviewerDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/live/:sessionCode"
          element={
            <PrivateRoute publicPage={false}>
              <StudentSession />
            </PrivateRoute>
          }
        />
        <Route path="/error" element={<ErrorPage />} />
        <Route
          path="*"
          element={
            <ErrorPage message="We can't seem to find the page you're looking for" />
          }
        />
      </Routes>
      {!hideHeaderFooter && <Footer />}
    </>
  );
};

export default AppRouter;

export const SubDomainRouter = () => {
  return (
    <Routes>
      <Route path="/:url" element={<ShortenUrlPage />} />
    </Routes>
  );
};
