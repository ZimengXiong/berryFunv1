import { useState } from "react";
import { ProfileView } from "../components/profile/ProfileView";
import { ProfileEdit } from "../components/profile/ProfileEdit";
import { ChildrenManager } from "../components/profile/ChildrenManager";
import { Header } from "../components/layout/Header";
import { Footer } from "../components/layout/Footer";

export function Profile() {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>

          {isEditing ? (
            <ProfileEdit
              onCancel={() => setIsEditing(false)}
              onSave={() => setIsEditing(false)}
            />
          ) : (
            <ProfileView onEdit={() => setIsEditing(true)} />
          )}

          <ChildrenManager />
        </div>
      </main>
      <Footer />
    </div>
  );
}
