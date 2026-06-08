import "./profile.css";
import { useProfilePage } from "./profile.logic";

export function ProfilePage() {
  const { title } = useProfilePage();
  return (
    <div className="profile-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="profile-title text-3xl font-semibold">{title}</h1>
      <p className="profile-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default ProfilePage;
