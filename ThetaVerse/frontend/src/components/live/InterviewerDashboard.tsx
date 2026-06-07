import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveSession } from "../../hooks/useLiveSession";

const StudentThumbnail = ({ stream }: { stream: MediaStream | undefined }) => {
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
      muted
      className="w-41 h-23 object-cover block bg-[#1a1a1a]"
    />
  );
};

const InterviewerDashboard = () => {
  const { hostId, sessionCode } = useParams<{
    hostId: string;
    sessionCode: string;
  }>();
  const hasRouteParams = Boolean(sessionCode && hostId);
  const [selectedCapacity, setSelectedCapacity] = useState(1);
  const [_focusedStudentId, _setFocusedStudentId] = useState<string | null>(
    null,
  );
  const focusedStudentIdRef = useRef<string | null>(null);

  const setFocusedStudentId = (id: string | null) => {
    focusedStudentIdRef.current = id;
    _setFocusedStudentId(id);
  };

  const {
    participants,
    errorMessage,
    localStream,
    remoteStreams,
    admitStudent,
    rejectStudent,
    removeAdmittedStudent,
    sessionCapacity,
    hostMediaPermissions,
    setAdmitCapacity,
    updateHostVisibilityPermissions,
    toggleMedia,
    startScreenShare,
    stopScreenShare,
  } = useLiveSession(sessionCode || "", "Interviewer", true, hostId);

  if (!hasRouteParams) {
    return null;
  }

  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const selfVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (sessionCapacity?.capacity !== undefined) {
      setSelectedCapacity(sessionCapacity.capacity);
    }
  }, [sessionCapacity?.capacity]);

  useEffect(() => {
    if (selfVideoRef.current && localStream) {
      selfVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const waitingParticipants = participants.filter(
    (p) => p.role === "STUDENT" && p.status === "WAITING",
  );
  const admittedParticipants = participants.filter(
    (p) => p.role === "STUDENT" && p.status === "ADMITTED",
  );

  // Auto-focus first student
  useEffect(() => {
    if (!focusedStudentIdRef.current && admittedParticipants.length > 0) {
      monitorStudent(admittedParticipants[0].id);
    }
  }, [admittedParticipants]);

  const handleCapacityChange = (value: number) => {
    setSelectedCapacity(value);
    setAdmitCapacity(value);
  };

  const handleToggleCamera = async () => {
    const nextEnabled = !hostMediaPermissions.videoEnabled;
    const success = await toggleMedia("video", nextEnabled);
    if (!success) {
      return;
    }
    updateHostVisibilityPermissions({
      ...hostMediaPermissions,
      videoEnabled: nextEnabled,
    });
  };

  const handleToggleAudio = async () => {
    const nextEnabled = !hostMediaPermissions.audioEnabled;
    const success = await toggleMedia("audio", nextEnabled);
    if (!success) {
      return;
    }
    updateHostVisibilityPermissions({
      ...hostMediaPermissions,
      audioEnabled: nextEnabled,
    });
  };

  const handleToggleScreenShare = async () => {
    if (hostMediaPermissions.screenEnabled) {
      await stopScreenShare();
      updateHostVisibilityPermissions({
        ...hostMediaPermissions,
        screenEnabled: false,
      });
    } else {
      await startScreenShare();
      updateHostVisibilityPermissions({
        ...hostMediaPermissions,
        screenEnabled: true,
      });
    }
  };

  const monitorStudent = (participantId: string) => {
    setFocusedStudentId(participantId);

    // Swap srcObject on main stage
    if (mainVideoRef.current) {
      const stream = remoteStreams[participantId];
      if (stream) {
        mainVideoRef.current.srcObject = stream;
      } else {
        mainVideoRef.current.srcObject = null;
      }
    }
  };

  // Wire up ontrack for the main stage to only show the focused student
  useEffect(() => {
    if (focusedStudentIdRef.current && mainVideoRef.current) {
      const stream = remoteStreams[focusedStudentIdRef.current];
      if (stream) {
        mainVideoRef.current.srcObject = stream;
      }
    }
  }, [remoteStreams]);

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-white">
      {/* LEFT CONTROL PANEL */}
      <div className="w-80 border-r border-[#262626] bg-[#141414] p-4 flex flex-col z-20 relative">
        <div className="mb-6 pb-4 border-b border-[#262626]">
          <h2 className="text-xl font-bold bg-linear-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Interview Control
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Code:{" "}
            <span className="font-mono bg-[#262626] px-2 py-1 rounded text-white">
              {sessionCode}
            </span>
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Admitted: {sessionCapacity.admittedCount}/{sessionCapacity.capacity}
          </p>
        </div>

        <div className="mb-5 rounded-lg border border-[#2d2d2d] p-3 bg-[#1a1a1a]">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">
            Admission Capacity
          </p>
          <select
            value={selectedCapacity}
            onChange={(event) =>
              handleCapacityChange(Number(event.target.value))
            }
            className="w-full bg-[#101010] border border-[#333] rounded px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map((capacity) => (
              <option key={capacity} value={capacity}>
                {capacity} student{capacity > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5 rounded-lg border border-[#2d2d2d] p-3 bg-[#1a1a1a]">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">
            Host Controls
          </p>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={handleToggleCamera}
              className={`text-sm py-2 px-3 rounded border ${hostMediaPermissions.videoEnabled ? "bg-emerald-700/40 border-emerald-500/50" : "bg-[#111] border-[#333]"}`}
            >
              {hostMediaPermissions.videoEnabled ? "Disable" : "Enable"} Camera
            </button>
            <button
              onClick={handleToggleAudio}
              className={`text-sm py-2 px-3 rounded border ${hostMediaPermissions.audioEnabled ? "bg-emerald-700/40 border-emerald-500/50" : "bg-[#111] border-[#333]"}`}
            >
              {hostMediaPermissions.audioEnabled ? "Disable" : "Enable"} Audio
            </button>
            <button
              onClick={handleToggleScreenShare}
              className={`text-sm py-2 px-3 rounded border ${hostMediaPermissions.screenEnabled ? "bg-emerald-700/40 border-emerald-500/50" : "bg-[#111] border-[#333]"}`}
            >
              {hostMediaPermissions.screenEnabled ? "Stop" : "Start"} Screen
              Share
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded border border-rose-600/50 bg-rose-900/20 p-3 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Waiting ({waitingParticipants.length})
          </h3>
          {waitingParticipants.length === 0 && (
            <p className="text-sm text-gray-600 italic">No one waiting.</p>
          )}
          <div className="space-y-3 mb-8">
            {waitingParticipants.map((p) => (
              <div
                key={p.id}
                className="bg-[#1e1e1e] border border-[#333] p-3 rounded-lg flex flex-col gap-2"
              >
                <span className="truncate text-sm font-medium">{p.name}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => admitStudent(p.id)}
                    className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded transition flex-1"
                  >
                    Admit
                  </button>
                  <button
                    onClick={() => rejectStudent(p.id)}
                    className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded transition flex-1"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER STAGE */}
      <div className="flex-1 relative bg-[#0f0f0f]">
        {/* MAIN STAGE */}
        <video
          ref={mainVideoRef}
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />

        {/* SELF PREVIEW */}
        {localStream && localStream.getVideoTracks().length > 0 && (
          <video
            ref={selfVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              width: "160px",
              height: "90px",
              objectFit: "cover",
              borderRadius: "8px",
              border: "1.5px solid rgba(255,255,255,0.2)",
              zIndex: 10,
              background: "#1a1a1a",
            }}
          />
        )}

        {/* ADMITTED STUDENTS SIDEBAR */}
        {admittedParticipants.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: "180px",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "12px 8px",
              background: "rgba(0,0,0,0.45)",
              overflowY: "auto",
              zIndex: 10,
            }}
          >
            {admittedParticipants.map((student) => (
              <div
                key={student.id}
                onClick={() => monitorStudent(student.id)}
                style={{
                  cursor: "pointer",
                  borderRadius: "8px",
                  overflow: "hidden",
                  border:
                    focusedStudentIdRef.current === student.id
                      ? "2px solid #1D9E75"
                      : "1.5px solid rgba(255,255,255,0.15)",
                  position: "relative",
                }}
              >
                <StudentThumbnail stream={remoteStreams[student.id]} />
                <div
                  style={{
                    position: "absolute",
                    bottom: "4px",
                    left: "6px",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: "11px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "calc(100% - 12px)",
                  }}
                >
                  <span className="truncate">{student.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAdmittedStudent(student.id);
                    }}
                    className="text-red-400 hover:text-red-300 ml-2"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewerDashboard;
