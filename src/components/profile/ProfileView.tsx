import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuth } from "../../lib/AuthContext";

interface ProfileViewProps {
  onEdit: () => void;
}

export function ProfileView({ onEdit }: ProfileViewProps) {
  const { isAuthenticated } = useAuth();
  const profile = useQuery(api.users.getProfile, isAuthenticated ? {} : "skip");

  if (!profile) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {profile.firstName} {profile.lastName}
          </h2>
          <p className="text-gray-600">{profile.email}</p>
        </div>
        <button
          onClick={onEdit}
          className="bg-berry-600 hover:bg-berry-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Edit Profile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
          <p className="text-gray-900">{profile.phone || "Not provided"}</p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Member Since</h3>
          <p className="text-gray-900">
            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "N/A"}
          </p>
        </div>

        {profile.address && (
          <div className="md:col-span-2">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Address</h3>
            <p className="text-gray-900">
              {profile.address.street}, {profile.address.city}, {profile.address.state}{" "}
              {profile.address.zip}
            </p>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Referral Code</h3>
          <div className="flex items-center space-x-2">
            <code className="bg-gray-100 px-3 py-1 rounded text-berry-600 font-mono">
              {profile.referralCode}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(profile.referralCode || "")}
              className="text-gray-500 hover:text-gray-700"
              title="Copy to clipboard"
            >
              📋
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
          <div className="flex flex-wrap gap-2">
            {profile.isReturning && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Returning Camper
              </span>
            )}
            {profile.siblingGroupId && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Sibling Discount
              </span>
            )}
            {profile.role === "admin" && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Admin
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
