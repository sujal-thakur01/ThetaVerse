import axios from 'axios';
import { logExecution } from '../utils/executionLogger';

// Create an Axios instance with base configuration
const apiClient = axios.create({
    baseURL: 'http://localhost:8080/api', // Adjust if your backend port is different
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use((config) => {
    const startedAt = performance.now();
    (config as any).metadata = { startedAt };
    logExecution('API', `request ${String(config.method || 'get').toUpperCase()} ${config.url}`);

    const requestUrl = String(config.url || '');
    const isPublicAuthRoute = requestUrl === '/auth/login' || requestUrl === '/auth/register';
    const token = localStorage.getItem('token');
    if (token && !isPublicAuthRoute) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

apiClient.interceptors.response.use((response) => {
    const startedAt = (response.config as any).metadata?.startedAt;
    const durationMs = typeof startedAt === 'number' ? Math.round(performance.now() - startedAt) : undefined;
    logExecution('API', `response ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        durationMs,
    });
    return response;
}, (error) => {
    const config = error.config ?? {};
    const startedAt = (config as any).metadata?.startedAt;
    const durationMs = typeof startedAt === 'number' ? Math.round(performance.now() - startedAt) : undefined;
    logExecution('API', `error ${String(config.method || 'get').toUpperCase()} ${config.url}`, {
        durationMs,
    });
    return Promise.reject(error);
});

export const api = {
    // Auth
    login: (credentials: any) => apiClient.post('/auth/login', credentials),
    register: (credentials: any) => apiClient.post('/auth/register', credentials),

    // Profiles
    createUser: (userData: any) => apiClient.post('/profiles/user', userData),
    createTargetProfile: (profileData: any) => apiClient.post('/profiles/target', profileData),

    // Roadmaps
    generateRoadmap: (targetProfileId: number) => apiClient.post(`/roadmaps/generate/${targetProfileId}`),
    scheduleTasks: (roadmapId: number) => apiClient.post(`/roadmaps/${roadmapId}/schedule`),

    // Interviews
    startInterview: (profileId: number, mood: string) =>
        apiClient.post(`/interviews/start?profileId=${profileId}&mood=${mood}`),
    askNextQuestion: (sessionId: number, topic: string) =>
        apiClient.post(`/interviews/${sessionId}/question?topic=${topic}`),
    evaluateAnswer: (questionId: number, userAnswer: string) =>
        apiClient.post(`/interviews/question/${questionId}/evaluate`, userAnswer, {
            headers: { 'Content-Type': 'text/plain' } // If sending raw string
        }),

    // Focus
    startFocusTracking: (sessionId: number) => apiClient.post(`/focus/start/${sessionId}`),
    recordDistraction: (focusSessionId: number, type: string) =>
        apiClient.post(`/focus/${focusSessionId}/alert?type=${type}`),
    getFinalFocusScore: (focusSessionId: number) => apiClient.get(`/focus/${focusSessionId}/score`),
};

export default apiClient;
