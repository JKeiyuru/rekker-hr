// client/src/pages/Profile.jsx
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import ProfileForm from '../components/ProfileForm';
import ProfileProgress from '../components/ProfileProgress';
import Avatar from '../components/Avatar';
import { Spinner, EmptyState } from '../components/Feedback';

export default function Profile() {
  const { user, profile, setProfile, profileLoading } = useAuth();

  if (profileLoading) return <Spinner />;
  if (!profile) {
    return (
      <EmptyState
        title="Your login isn’t linked to an employee record yet"
        description="Ask HR to link your account to your employee record so you can manage your profile."
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="My profile" subtitle="Keep your personal details up to date" />
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-4 mb-5">
          <Avatar name={user?.name} src={profile.readOnly.photoUrl} />
          <div>
            <p className="font-medium text-ink">
              {profile.editable.firstName} {profile.editable.lastName}
            </p>
            <p className="text-sm text-muted">
              {[profile.readOnly.jobTitle, profile.readOnly.department].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <ProfileProgress completion={profile.completion} />
      </div>
      <div className="card p-5">
        <ProfileForm profile={profile} onSaved={setProfile} />
      </div>
    </div>
  );
}
