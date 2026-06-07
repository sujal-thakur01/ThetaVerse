import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveSession } from "../../hooks/useLiveSession";
import apiClient from "../../api/apiClient";

const VideoPlayer = ({
  stream,
  isLocal = false,
}: {
  stream: MediaStream | null;
  isLocal?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className="w-full h-full object-cover bg-black"
    />
  );
};

const StudentSession = () => {
  const { sessionCode } = useParams<{ sessionCode: string }>();
  const normalizedSessionCode = (sessionCode ?? "").trim().toUpperCase();
  const [studentName, setStudentName] = useState("");
  const [joined, setJoined] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinRequest = async () => {
    if (!studentName.trim() || !normalizedSessionCode) {
      return;
    }

    setIsValidating(true);
    setJoinError(null);
    try {
      await apiClient.get(`/live-sessions/validate/${normalizedSessionCode}`);
      setJoined(true);
    } catch (error: any) {
      console.error("Failed to validate session code", error);
      const status = error?.response?.status;
      if (status === 404) {
        setJoinError(
          "Session code is invalid or expired. Make sure the interviewer room is currently active.",
        );
        return;
      }
      if (status === 401 || status === 403) {
        setJoinError(
          "Your session is not authorized. Please log in again and retry.",
        );
        return;
      }
      setJoinError("Unable to validate session right now. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f0f]">
        <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-8 max-w-sm w-full text-white shadow-xl">
          <h2 className="text-xl font-bold mb-4">Join Interview Session</h2>
          <p className="text-gray-400 mb-6 text-sm">
            Session: <strong>{normalizedSessionCode}</strong>
          </p>
          <input
            type="text"
            placeholder="Your Name"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            className="w-full bg-[#121212] border border-[#333] rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 transition-colors mb-4"
          />
          {joinError && (
            <p className="text-xs text-rose-300 mb-3">{joinError}</p>
          )}
          <button
            onClick={() => void handleJoinRequest()}
            disabled={isValidating || !studentName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3 rounded-lg transition"
          >
            {isValidating ? "Validating..." : "Ask to Join"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <ActiveStudentSession
      sessionCode={normalizedSessionCode}
      studentName={studentName}
    />
  );
};

const ActiveStudentSession = ({
  sessionCode,
  studentName,
}: {
  sessionCode: string;
  studentName: string;
}) => {
  const {
    myStatus,
    errorMessage,
    localStream,
    remoteStreams,
    getMedia,
    toggleMedia,
    hostMediaPermissions,
    startScreenShare,
    stopScreenShare,
  } = useLiveSession(sessionCode, studentName, false);

  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  useEffect(() => {
    void getMedia(true, true).then((stream) => {
      if (!stream) {
        return;
      }
      stream.getVideoTracks().forEach((track) => {
        track.enabled = false;
      });
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    });
  }, []);

  const handleToggleVideo = () => {
    toggleMedia("video");
    setIsVideoEnabled(!isVideoEnabled);
  };

  const handleToggleAudio = () => {
    toggleMedia("audio");
    setIsAudioEnabled(!isAudioEnabled);
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      const stopped = await stopScreenShare();
      if (stopped) {
        setIsScreenSharing(false);
      }
      return;
    }

    const started = await startScreenShare();
    if (started) {
      setIsScreenSharing(true);
      setIsVideoEnabled(true);
    }
  };

  if (myStatus === "WAITING") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f0f] text-white">
        <div className="animate-pulse bg-[#1e1e1e] border border-[#333] p-8 rounded-xl flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6"></div>
          <h2 className="text-xl font-semibold">
            Waiting for the host to let you in...
          </h2>
          <p className="text-gray-400 mt-2 text-sm">
            Your status is visible to the host. You can only enter when
            admitted.
          </p>
          {errorMessage && (
            <p className="mt-4 text-xs text-rose-300 text-center max-w-sm">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (myStatus === "REJECTED") {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f0f0f] text-white">
        <div className="bg-red-900/20 border border-red-800/50 p-8 rounded-xl text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">
            Request Denied
          </h2>
          <p className="text-red-200/70">
            The host has rejected your request to join.
          </p>
        </div>
      </div>
    );
  }

  // Host stream (assuming there is only one host, the first key in remoteStreams is typically the host if everyone else is p2p via host)
  const hostId = Object.keys(remoteStreams)[0];
  const hostStream = hostId ? remoteStreams[hostId] : null;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-[#111] border-b border-[#2a2a2a] text-sm text-gray-300 flex items-center justify-between">
        <span>Status: Admitted</span>
        <span>
          Host Media: Video {hostMediaPermissions.videoEnabled ? "ON" : "OFF"} |
          Audio {hostMediaPermissions.audioEnabled ? "ON" : "OFF"} | Screen{" "}
          {hostMediaPermissions.screenEnabled ? "ON" : "OFF"}
        </span>
      </div>

      {errorMessage && (
        <div className="px-4 py-2 text-xs text-rose-300 bg-rose-900/30 border-b border-rose-500/40">
          {errorMessage}
        </div>
      )}

      <div className="flex-1 w-full h-full relative">
        {hostStream ? (
          <VideoPlayer stream={hostStream} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#111] text-gray-500">
            {hostMediaPermissions.videoEnabled ||
            hostMediaPermissions.screenEnabled ||
            hostMediaPermissions.audioEnabled
              ? "Connecting to host media..."
              : "Host has not enabled media visibility yet."}
          </div>
        )}

        <div className="absolute top-4 right-4 w-48 aspect-video bg-[#1e1e1e] border border-gray-700 shadow-2xl rounded-lg overflow-hidden z-20">
          <VideoPlayer stream={localStream} isLocal={true} />
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full border border-gray-800 z-20 shadow-2xl transition hover:bg-black/80">
          <button
            onClick={handleToggleAudio}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition ${isAudioEnabled ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
          >
            {isAudioEnabled ? "🎤" : "🔇"}
          </button>
          <button
            onClick={handleToggleVideo}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition ${isVideoEnabled ? "bg-gray-800 hover:bg-gray-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}`}
          >
            {isVideoEnabled ? "📷" : "🚫"}
          </button>
          <button
            onClick={() => void handleToggleScreenShare()}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition ${isScreenSharing ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-gray-800 hover:bg-gray-700 text-white"}`}
          >
            🖥️
          </button>
          <div className="w-px h-8 bg-gray-700 mx-2"></div>
          <span className="text-sm text-gray-300">
            Controlled by interviewer
          </span>
        </div>
      </div>
    </div>
  );
};

export default StudentSession;
