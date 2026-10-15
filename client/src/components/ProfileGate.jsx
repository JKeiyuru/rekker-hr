// client/src/components/ProfileGate.jsx
// Full-screen popup shown on every login / page load until the user's profile
// is 100% complete. It can't be dismissed - the only other option is signing out.
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileForm from './ProfileForm';
import ProfileProgress from './ProfileProgress';

export default function ProfileGate() {
  const { user, profile, setProfile, logout } = useAuth();
  if (!profile || profile.completion.complete) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="profile-gate-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn" />
      <div className="relative flex max-h-full w-full max-w-3xl flex-col card animate-riseIn overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="profile-gate-title" className="text-lg font-semibold text-ink">
                Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''} — let’s complete your profile
              </h2>
              <p className="text-sm text-muted mt-1">
                We need a few details before you continue. Your progress is saved each time you press Save.
              </p>
            </div>
            <button
              onClick={logout}
              className="focus-ring shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface2 hover:text-ink"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
          <div className="mt-4">
            <ProfileProgress completion={profile.completion} />
          </div>
        </div>
        <div className="overflow-y-auto px-6 pt-5 pb-3">
          <ProfileForm profile={profile} onSaved={setProfile} showReadOnly={false} />
        </div>
      </div>
    </div>
  );
}
