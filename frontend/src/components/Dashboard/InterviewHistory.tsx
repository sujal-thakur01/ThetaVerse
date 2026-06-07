import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, History, PlayCircle } from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "../../api/apiClient";
import { useStoreContext } from "../../contextApi/ContextApi";
import { logExecution } from "../../utils/executionLogger";

interface InterviewSessionSummary {
  id: number;
  companyName: string;
  position: string;
  roundTypes: string;
  mood: string;
  startTime: string;
  endTime: string | null;
  resumeText: string | null;
}

interface InterviewSlotSummary {
  slotId: number;
  interviewerId: number;
  interviewerName: string;
  startTime: string;
  endTime: string;
  booked: boolean;
}

export default function InterviewHistory() {
  const navigate = useNavigate();
  const { currentUserId, currentUser } = useStoreContext();
  const isInterviewer = currentUser?.role === "INTERVIEWER";
  const [sessions, setSessions] = useState<InterviewSessionSummary[]>([]);
  const [slots, setSlots] = useState<InterviewSlotSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      if (!currentUserId) {
        setIsLoading(false);
        return;
      }

      try {
        if (isInterviewer) {
          const response = await apiClient.get("/interviewers/slots/me");
          setSlots(response.data);
          logExecution(
            "InterviewHistory.loadHistory",
            "interviewer slots loaded",
            {
              userId: currentUserId,
              count: response.data.length,
            },
          );
        } else {
          const response = await apiClient.get(
            `/interviews/user/${currentUserId}`,
          );
          setSessions(response.data);
          logExecution("InterviewHistory.loadHistory", "history loaded", {
            userId: currentUserId,
            count: response.data.length,
          });
        }
      } catch (error) {
        console.error("Failed to load interview history", error);
        toast.error("Failed to load interview history");
      } finally {
        setIsLoading(false);
      }
    };

    void loadHistory();
  }, [currentUserId, isInterviewer]);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
          <History className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">
            {isInterviewer ? "Interviewer Slot History" : "Interview History"}
          </h1>
          <p className="text-neutral-400">
            {isInterviewer
              ? "View all slots you created, including booked and available ones."
              : "View your previous sessions and open detailed logs."}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-neutral-500 animate-pulse">
          Loading {isInterviewer ? "slot history" : "interview history"}...
        </div>
      ) : isInterviewer ? (
        slots.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center text-neutral-400">
            No slots found yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {slots.map((slot) => (
              <div
                key={slot.slotId}
                className="rounded-3xl border border-neutral-800 bg-linear-to-b from-neutral-900/90 to-neutral-900/50 p-6 shadow-lg"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                    Slot #{slot.slotId}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      slot.booked
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    {slot.booked ? "Booked" : "Available"}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">
                  {new Date(slot.startTime).toLocaleString()}
                </h3>
                <p className="text-sm text-neutral-400 mb-2">
                  Ends at {new Date(slot.endTime).toLocaleTimeString()}
                </p>

                <div className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300">
                  <Clock className="w-3.5 h-3.5" />
                  {slot.booked ? "Already booked" : "Open for booking"}
                </div>
                <div className="block w-full rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-semibold text-neutral-200 text-center">
                  Controlled live session slot
                </div>
              </div>
            ))}
          </div>
        )
      ) : sessions.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900/30 p-12 text-center text-neutral-400">
          No interviews found yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-3xl border border-neutral-800 bg-linear-to-b from-neutral-900/90 to-neutral-900/50 p-6 shadow-lg"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-300">
                  {session.position}
                </span>
                <span className="text-xs text-neutral-500">#{session.id}</span>
              </div>

              <h3 className="text-xl font-bold text-white mb-1">
                {session.companyName}
              </h3>
              <p className="text-sm text-neutral-400 mb-2">
                {session.roundTypes || "Technical"}
              </p>
              <p className="text-xs text-neutral-500 mb-4">
                Mood: {session.mood}
              </p>

              <div className="mb-5 inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/60 px-2.5 py-1 text-xs text-neutral-300">
                <Clock className="w-3.5 h-3.5" />
                {session.endTime ? "Completed" : "In Progress"}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/interview/logs/${session.id}`)}
                  className="flex-1 rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-neutral-700 transition"
                >
                  View Logs
                </button>
                {!session.endTime && (
                  <button
                    onClick={() => navigate(`/interview/${session.id}`)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Resume
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
