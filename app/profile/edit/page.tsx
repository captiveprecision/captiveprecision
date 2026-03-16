import Link from "next/link";

export default function EditProfilePage() {
  return (
    <main className="workspace-shell page-stack">
      <section className="surface-card panel-pad profile-edit-shell">
        <div className="profile-edit-top">
          <div>
            <div className="metric-label">Profile</div>
            <h1 className="page-title profile-edit-title">Edit profile</h1>
            <p className="page-copy">
              Update the core information that will represent the coach or program inside the platform.
            </p>
          </div>

          <Link className="profile-edit-button" href="/profile">
            Back to profile
          </Link>
        </div>

        <form className="profile-form">
          <div className="profile-form-grid">
            <div className="profile-form-field profile-form-field-full">
              <label htmlFor="photo">Profile photo</label>
              <div className="profile-photo-row">
                <div className="profile-avatar profile-avatar-edit" aria-hidden="true">
                  EM
                </div>
                <div>
                  <input id="photo" type="text" defaultValue="https://images.example.com/profile-edith.jpg" />
                  <p className="muted-copy">Paste an image URL for now. File upload can come later.</p>
                </div>
              </div>
            </div>

            <div className="profile-form-field">
              <label htmlFor="name">Full name</label>
              <input id="name" type="text" defaultValue="Edith Morales" />
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
              <textarea
                id="about"
                rows={6}
                defaultValue="Captive Precision is building a premium toolkit for cheer coaches and program owners. This profile acts as the public-facing identity inside the platform and will later connect to saved tools, memberships, and history."
              />
            </div>
          </div>

          <div className="profile-form-actions">
            <button type="submit" className="profile-edit-button">
              Save changes
            </button>
            <Link className="profile-cancel-link" href="/profile">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
