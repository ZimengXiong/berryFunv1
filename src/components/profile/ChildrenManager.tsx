import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../lib/AuthContext";
import type { Id } from "../../../convex/_generated/dataModel";

export function ChildrenManager() {
  const { isAuthenticated } = useAuth();
  const children = useQuery(api.children.getChildren, isAuthenticated ? {} : "skip");
  const addChild = useMutation(api.children.addChild);
  const updateChild = useMutation(api.children.updateChild);
  const removeChild = useMutation(api.children.removeChild);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<Id<"children"> | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    allergies: "",
    medicalNotes: "",
  });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      allergies: "",
      medicalNotes: "",
    });
    setIsAdding(false);
    setEditingId(null);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) return;

    setError("");

    try {
      if (editingId) {
        await updateChild({
          childId: editingId,
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth || undefined,
          allergies: formData.allergies || undefined,
          medicalNotes: formData.medicalNotes || undefined,
        });
      } else {
        await addChild({
          firstName: formData.firstName,
          lastName: formData.lastName,
          dateOfBirth: formData.dateOfBirth || undefined,
          allergies: formData.allergies || undefined,
          medicalNotes: formData.medicalNotes || undefined,
        });
      }
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save child");
    }
  };

  const handleEdit = (child: any) => {
    setFormData({
      firstName: child.firstName,
      lastName: child.lastName,
      dateOfBirth: child.dateOfBirth || "",
      allergies: child.allergies || "",
      medicalNotes: child.medicalNotes || "",
    });
    setEditingId(child.id);
    setIsAdding(true);
  };

  const handleRemove = async (childId: Id<"children">) => {
    if (!isAuthenticated) return;
    if (!confirm("Are you sure you want to remove this child?")) return;

    try {
      await removeChild({ childId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove child");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Children</h2>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Add Child
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-gray-900 mb-4">
            {editingId ? "Edit Child" : "Add New Child"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input
                name="dateOfBirth"
                type="date"
                value={formData.dateOfBirth}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
              <input
                name="allergies"
                type="text"
                value={formData.allergies}
                onChange={handleChange}
                placeholder="e.g., Peanuts, Bee stings"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Medical Notes</label>
              <textarea
                name="medicalNotes"
                value={formData.medicalNotes}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-berry-500 focus:border-berry-500 outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg"
            >
              {editingId ? "Save Changes" : "Add Child"}
            </button>
          </div>
        </form>
      )}

      {children && children.length > 0 ? (
        <div className="space-y-4">
          {children.map((child) => (
            <div key={child.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">
                    {child.firstName} {child.lastName}
                  </h4>
                  {child.dateOfBirth && (
                    <p className="text-sm text-gray-600">
                      Born: {new Date(child.dateOfBirth).toLocaleDateString()}
                    </p>
                  )}
                  {child.allergies && (
                    <p className="text-sm text-red-600 mt-1">
                      Allergies: {child.allergies}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(child)}
                    className="text-gray-500 hover:text-berry-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemove(child.id)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          No children added yet. Add your children to enroll them in camp sessions.
        </p>
      )}
    </div>
  );
}
