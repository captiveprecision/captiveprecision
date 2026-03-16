import Link from "next/link";

export default function CoachProfileEditPage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad profile-edit-shell">
        <div className="profile-edit-top">
          <div>
            <div className="metric-label">Profile editor</div>
            <h1 className="page-title profile-edit-title">Edit profile</h1>
            <p className="page-copy">
              This form is still static for now, but it defines the structure we will later connect to real saved coach data.
            </p>
          </div>

          <Link className="profile-edit-button" href="/coach/profile">
            Back to profile
          </Link>
        </div>

        <form className="profile-form">
          <section className="profile-photo-row">
            <div className="profile-avatar profile-avatar-edit" aria-hidden="true">
              EM
            </div>
            <div className="profile-form-field">
              <label htmlFor="profile-photo">Profile photo</label>
              <input id="profile-photo" type="text" defaultValue="Profile image placeholder" />
            </div>
          </section>

          <div className="profile-form-grid">
            <div className="profile-form-field">
              <label htmlFor="full-name">Full name</label>
              <input id="full-name" type="text" defaultValue="Edith Morales" />
            </div>
            <div className="profile-form-field">
              <label htmlFor="role">Role</label>
              <input id="role" type="text" defaultValue="Owner / Head Coach" />
            </div>
            <div className="profile-form-field">
              <label htmlFor="gym">Gym</label>
              <input id="gym" type="text" defaultValue="Captive Precision Athletics" />
            </div>
            <div className="profile-form-field">
              <label htmlFor="location">Location</label>
              <input id="location" type="text" defaultValue="Miami, Florida" />
            </div>
            <div className="profile-form-field profile-form-field-full">
              <label htmlFor="headline">Headline</label>
              <input id="headline" type="text" defaultValue="Coach, choreographer, and owner at Captive Precision" />
            </div>
            <div className="profile-form-field profile-form-field-full">
              <label htmlFor="teams">Teams</label>
              <input id="teams" type="text" defaultValue="Senior Elite, Junior Level 2, Open Coed Prep" />
            </div>
            <div className="profile-form-field profile-form-field-full">
              <label htmlFor="about">About</label>
              <textarea id="about" rows={6} defaultValue="Captive Precision is building a premium toolkit for cheer coaches and program owners. This profile acts as the public-facing identity inside the platform and will later connect to saved tools, memberships, and history." />
            </div>
          </div>

          <div className="profile-form-actions">
            <button type="button" className="profile-edit-button">
              Save changes
            </button>
            <Link className="profile-cancel-link" href="/coach/profile">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
