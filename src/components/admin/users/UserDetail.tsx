import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuth } from "../../../lib/AuthContext";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Link } from "react-router-dom";

interface UserDetailProps {
  userId: Id<"users">;
}

export function UserDetail({ userId }: UserDetailProps) {
  const { isAuthenticated } = useAuth();
  const user = useQuery(api.users.getUser, isAuthenticated ? { userId } : "skip");
  const balance = useQuery(api.deltaEngine.calculateUserBalance, isAuthenticated ? { userId } : "skip");
  const updateUser = useMutation(api.users.updateUser);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    isReturning: false,
    siblingGroupId: "",
    role: "user" as "user" | "admin",
    isActive: true,
  });

  if (!user) {
    return <div className="animate-pulse bg-white rounded-xl shadow-md p-6 h-48"></div>;
  }

  const handleEdit = () => {
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      isReturning: user.isReturning,
      siblingGroupId: user.siblingGroupId || "",
      role: user.role,
      isActive: user.isActive,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!isAuthenticated) return;

    await updateUser({
      userId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      isReturning: formData.isReturning,
      siblingGroupId: formData.siblingGroupId || undefined,
      role: formData.role,
      isActive: formData.isActive,
    });

    setIsEditing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          to="/admin/users"
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back to Users
        </Link>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
          <button
            onClick={isEditing ? handleSave : handleEdit}
            className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isEditing ? "Save Changes" : "Edit User"}
          </button>
        </div>

        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={e => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={e => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData(prev => ({ ...prev, role: e.target.value as "user" | "admin" }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sibling Group ID</label>
              <input
                type="text"
                value={formData.siblingGroupId}
                onChange={e => setFormData(prev => ({ ...prev, siblingGroupId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isReturning}
                  onChange={e => setFormData(prev => ({ ...prev, isReturning: e.target.checked }))}
                  className="rounded border-gray-300 text-berry-600"
                />
                <span className="text-sm text-gray-700">Returning Camper</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={e => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-gray-300 text-berry-600"
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500">Phone</h4>
              <p className="text-gray-900">{user.phone || "Not provided"}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Role</h4>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.role}
              </span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Status</h4>
              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    user.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                  }`}
                >
                  {user.isActive ? "Active" : "Inactive"}
                </span>
                {user.isReturning && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Returning
                  </span>
                )}
                {user.siblingGroupId && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Siblings
                  </span>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Referral Code</h4>
              <code className="bg-gray-100 px-2 py-1 rounded text-sm">{user.referralCode}</code>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500">Joined</h4>
              <p className="text-gray-900">{new Date(user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Balance Summary */}
      {balance && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Balance Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{balance.weekCount}</p>
              <p className="text-sm text-gray-500">Total Weeks</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(balance.grossTuition)}</p>
              <p className="text-sm text-gray-500">Gross Tuition</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{formatCurrency(balance.totalPaid)}</p>
              <p className="text-sm text-gray-500">Total Paid</p>
            </div>
            <div className="text-center p-4 bg-berry-50 rounded-lg">
              <p className="text-2xl font-bold text-berry-600">{formatCurrency(balance.balanceDue)}</p>
              <p className="text-sm text-gray-500">Balance Due</p>
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      {user.children && user.children.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Children</h3>
          <div className="space-y-3">
            {user.children.map(child => (
              <div key={child.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{child.firstName} {child.lastName}</p>
                  {child.dateOfBirth && (
                    <p className="text-sm text-gray-500">
                      DOB: {new Date(child.dateOfBirth).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
