import { useState } from "react";
import { useNavigate } from "react-router-dom";

const LiveSetup = () => {
  const [hostName, setHostName] = useState("Interviewer");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreateSession = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:8080/api/live-sessions/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostName }),
        },
      );
      const data = await response.json();
      if (data.sessionCode && data.hostId) {
        navigate(`/live/host/${data.hostId}/${data.sessionCode}`);
      }
    } catch (error) {
      console.error("Failed to create session", error);
      alert("Error creating session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full pt-10">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl p-8 max-w-md w-full text-white shadow-xl">
        <h2 className="text-2xl font-bold mb-4">Start Live Interview</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Create a strict-control real-time interview room. Generate a code and
          share it with students.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Interviewer Name
          </label>
          <input
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            className="w-full bg-[#121212] border border-[#333] rounded-lg px-4 py-2 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <button
          onClick={handleCreateSession}
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex justify-center"
        >
          {loading ? "Creating..." : "Create Session"}
        </button>
      </div>
    </div>
  );
};

export default LiveSetup;
