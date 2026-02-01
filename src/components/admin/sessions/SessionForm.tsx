import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import { useNavigate } from "react-router-dom";
import type { Id } from "../../../../convex/_generated/dataModel";

interface SessionFormProps {
  sessionId?: Id<"sessions">;
}

export function SessionForm({ sessionId }: SessionFormProps) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const existingSession = useQuery(
    api.sessions.getSession,
    sessionId ? { sessionId } : "skip"
  );

  const createSession = useMutation(api.sessions.createSession);
  const updateSession = useMutation(api.sessions.updateSession);
  const deleteSession = useMutation(api.sessions.deleteSession);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    basePrice: "",
    capacity: "",
    ageMin: "",
    ageMax: "",
    location: "",
    isActive: true,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (existingSession) {
      setFormData({
        name: existingSession.name,
        description: existingSession.description || "",
        startDate: existingSession.startDate,
        endDate: existingSession.endDate,
        basePrice: existingSession.basePrice.toString(),
        capacity: existingSession.capacity.toString(),
        ageMin: existingSession.ageMin?.toString() || "",
        ageMax: existingSession.ageMax?.toString() || "",
        location: existingSession.location || "",
        isActive: existingSession.isActive,
      });
    }
  }, [existingSession]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError("");
    setIsLoading(true);

    try {
      const sessionData = {
        token,
        name: formData.name,
        description: formData.description || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        basePrice: parseFloat(formData.basePrice),
        capacity: parseInt(formData.capacity),
        ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
        ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
        location: formData.location || undefined,
      };

      if (sessionId) {
        await updateSession({
          ...sessionData,
          sessionId,
          isActive: formData.isActive,
        });
      } else {
        await createSession(sessionData);
      }

      navigate("/admin/sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !sessionId) return;
    if (!confirm("Are you sure you want to delete this session?")) return;

    try {
      await deleteSession({ token, sessionId });
      navigate("/admin/sessions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {sessionId ? "Edit Session" : "Create New Session"}
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Summer Adventure Week 1"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
            <input
              name="startDate"
              type="date"
              value={formData.startDate}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
            <input
              name="endDate"
              type="date"
              value={formData.endDate}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price ($) *</label>
            <input
              name="basePrice"
              type="number"
              step="0.01"
              value={formData.basePrice}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
            <input
              name="capacity"
              type="number"
              value={formData.capacity}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Min Age</label>
            <input
              name="ageMin"
              type="number"
              value={formData.ageMin}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Age</label>
            <input
              name="ageMax"
              type="number"
              value={formData.ageMax}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              name="location"
              type="text"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g., Main Campus"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
            />
          </div>

          {sessionId && (
            <div className="md:col-span-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleChange}
                  className="rounded border-gray-300 text-berry-600"
                />
                <span className="text-sm text-gray-700">Active (visible to users)</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          {sessionId && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700"
            >
              Delete Session
            </button>
          )}
          <div className="flex space-x-4 ml-auto">
            <button
              type="button"
              onClick={() => navigate("/admin/sessions")}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-berry-600 hover:bg-berry-700 text-white px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {isLoading ? "Saving..." : sessionId ? "Save Changes" : "Create Session"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
