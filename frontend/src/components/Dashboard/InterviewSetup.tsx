import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";
import { Bot, CalendarPlus, Play, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { useStoreContext } from "../../contextApi/ContextApi";
import { withExecutionLog } from "../../utils/executionLogger";

export default function InterviewSetup() {
  const [companyName, setCompanyName] = useState("Barclays");
  const [position, setPosition] = useState("SDE2");
  const [roundTypes, setRoundTypes] = useState("Technical, HLD, HR");
  const [mood, setMood] = useState("Medium");
  const [resumeText, setResumeText] = useState("");
  const [mode, setMode] = useState("AI");
  const [sessionCode, setSessionCode] = useState("");
  const [createdLiveSession, setCreatedLiveSession] = useState<{
    code: string;
    hostId: string;
  } | null>(null);

  const [myHeadline, setMyHeadline] = useState("");
  const [myBio, setMyBio] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isSlotSaving, setIsSlotSaving] = useState(false);

  const navigate = useNavigate();
  const { currentUserId, currentUser } = useStoreContext();

  const isInterviewer = currentUser?.role === "INTERVIEWER";

  useEffect(() => {
    const init = async () => {
      try {
        if (isInterviewer) {
          const profileRes = await apiClient.get("/interviewers/profile/me");
          setMyHeadline(profileRes.data.headline || "");
          setMyBio(profileRes.data.bio || "");
        }
      } catch (error) {
        console.error("Failed to initialize interview setup", error);
      }
    };
    void init();
  }, [isInterviewer]);

  const handleSaveProfile = withExecutionLog(
    "InterviewSetup.handleSaveProfile",
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsProfileSaving(true);
      try {
        await apiClient.post("/interviewers/profile", {
          headline: myHeadline,
          bio: myBio,
        });
        toast.success("Profile saved");
      } catch (error) {
        console.error(error);
        toast.error("Failed to save profile");
      } finally {
        setIsProfileSaving(false);
      }
    },
  );

  const handleStartLive = async () => {
    setIsSlotSaving(true);
    try {
      const response = await apiClient.post("/live-sessions/create", {
        hostName: currentUser?.name || "Interviewer",
      });
      const data = response.data;
      if (data.sessionCode && data.hostId) {
        setCreatedLiveSession({ code: data.sessionCode, hostId: data.hostId });
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to create live session");
    } finally {
      setIsSlotSaving(false);
    }
  };

  const handleStart = withExecutionLog(
    "InterviewSetup.handleStart",
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      try {
        if (!currentUserId) {
          toast.error("Please sign in again to start an interview");
          return;
        }

        if (mode === "HUMAN") {
          if (!sessionCode) {
            toast.error("Please enter a valid session code");
            return;
          }
          navigate(`/live/${sessionCode}`);
          return;
        }

        const res = await apiClient.post("/interviews/start", {
          companyName,
          position,
          roundTypes,
          mood,
          mode,
          userId: currentUserId,
          resumeText,
        });

        toast.success("Interview Session Created");
        navigate(`/interview/${res.data.id}`);
      } catch (err) {
        toast.error("Failed to start session");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
  );

  if (isInterviewer) {
    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <UserRound className="w-6 h-6 text-indigo-400" />
              <h1 className="text-2xl font-bold text-white">
                Interviewer Profile
              </h1>
            </div>

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-neutral-300">
                  Headline
                </label>
                <input
                  type="text"
                  value={myHeadline}
                  onChange={(e) => setMyHeadline(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
                  placeholder="Senior Backend Engineer | Systems Design"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-neutral-300">
                  Bio
                </label>
                <textarea
                  value={myBio}
                  onChange={(e) => setMyBio(e.target.value)}
                  rows={4}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white resize-none"
                  placeholder="Share your experience and interview focus areas"
                />
              </div>
              <button
                disabled={isProfileSaving}
                type="submit"
                className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl"
              >
                {isProfileSaving ? "Saving..." : "Save Profile"}
              </button>
            </form>
          </div>

          <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <CalendarPlus className="w-6 h-6 text-emerald-400" />
              <h2 className="text-2xl font-bold text-white">Live Session</h2>
            </div>

            {createdLiveSession ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6">
                <p className="text-emerald-400 font-semibold mb-2 flex items-center justify-center gap-2">
                  Session Created Successfully!
                </p>
                <p className="text-neutral-300 text-sm mb-4 text-center">
                  Share this code with students to join:
                </p>
                <div className="bg-neutral-950 px-4 py-3 rounded-lg font-mono text-2xl text-center text-white font-bold tracking-widest mb-6 border border-neutral-800">
                  {createdLiveSession.code}
                </div>
                <button
                  onClick={() =>
                    navigate(
                      `/live/host/${createdLiveSession.hostId}/${createdLiveSession.code}`,
                    )
                  }
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                >
                  Enter Live Room
                </button>
                <p className="text-xs text-neutral-500 text-center mt-4">
                  You can copy the code and start the room later within the same
                  browser session.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-neutral-400 mb-6">
                  Create a real-time WebRTC session. You will be the host with
                  full control over admissions.
                </p>

                <button
                  disabled={isSlotSaving}
                  onClick={handleStartLive}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-xl"
                >
                  {isSlotSaving ? "Creating..." : "Start Live Interview Room"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-8 shadow-xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Interview Setup</h1>
            <p className="text-neutral-400">
              AI mock or human interviewer booking
            </p>
          </div>
        </div>

        <form onSubmit={handleStart} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-300">
              Interview Mode
            </label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
              }}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
            >
              <option value="AI">AI Interview</option>
              <option value="HUMAN">Live Human Interview (Code)</option>
            </select>
          </div>

          {mode === "HUMAN" && (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-neutral-300">
                Session Code
              </label>
              <input
                type="text"
                required
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value)}
                placeholder="Enter host code (e.g. 5d8a9b1c)"
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
              />
            </div>
          )}

          {mode === "AI" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-neutral-300">
                    Target Company
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-neutral-300">
                    Target Position
                  </label>
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-neutral-300">
                  Round Types
                </label>
                <input
                  type="text"
                  required
                  value={roundTypes}
                  onChange={(e) => setRoundTypes(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
                  placeholder="e.g. Technical, HLD, HR"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-neutral-300">
                  Interviewer Mood
                </label>
                <select
                  value={mood}
                  onChange={(e) => setMood(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white"
                >
                  <option value="Friendly">Friendly</option>
                  <option value="Medium">Medium</option>
                  <option value="Strict">Strict</option>
                </select>
              </div>
            </>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-neutral-300">
              Resume / Background Experience (Optional)
            </label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              rows={3}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white resize-none"
            />
          </div>

          <button
            disabled={isLoading}
            type="submit"
            className="mt-4 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading
              ? "Initializing..."
              : mode === "HUMAN"
                ? "Join Live Session"
                : "Start Session"}
            {!isLoading && <Play className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}
