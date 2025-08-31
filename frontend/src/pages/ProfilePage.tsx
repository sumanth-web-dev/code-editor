import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import preferencesService, { UserPreferences } from '../services/preferencesService';

const ProfilePage: React.FC = () => {
  const { user, updateProfile, changePassword, loading } = useAuth();
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    company: user?.company || '',
    bio: user?.bio || ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'preferences'>('profile');
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [preferencesLoading, setPreferencesLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'preferences') {
      loadPreferences();
    }
  }, [activeTab]);

  const loadPreferences = async () => {
    setPreferencesLoading(true);
    try {
      const prefs = await preferencesService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      console.error('Failed to load preferences:', error);
    } finally {
      setPreferencesLoading(false);
    }
  };

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    if (!preferences) return;
    
    const updatedPrefs = { ...preferences, [key]: value };
    setPreferences(updatedPrefs);
    
    try {
      await preferencesService.setPreference(key, value);
    } catch (error) {
      console.error('Failed to save preference:', error);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(profileData);
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      alert('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Password change failed:', error);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Profile Settings</h1>
        <p>Manage your account information and preferences</p>
      </div>

      <div className="profile-tabs">
        <button 
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile Information
        </button>
        <button 
          className={`tab ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          Change Password
        </button>
        <button 
          className={`tab ${activeTab === 'preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          Preferences
        </button>
      </div>

      <div className="profile-content">
        {activeTab === 'profile' && (
          <div className="profile-form-section">
            <h2>Profile Information</h2>
            <form onSubmit={handleProfileSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="company">Company</label>
                <input
                  type="text"
                  id="company"
                  value={profileData.company}
                  onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  rows={4}
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="password-form-section">
            <h2>Change Password</h2>
            <form onSubmit={handlePasswordSubmit} className="password-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={8}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  minLength={8}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="preferences-section">
            <h2>Preferences</h2>
            {preferencesLoading ? (
              <div>Loading preferences...</div>
            ) : preferences ? (
              <div className="preferences-form">
                <div className="preference-group">
                  <h3>Notifications</h3>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.emailNotifications}
                      onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                    />
                    Email notifications for account updates
                  </label>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.marketingEmails}
                      onChange={(e) => handlePreferenceChange('marketingEmails', e.target.checked)}
                    />
                    Marketing emails and promotions
                  </label>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.smsNotifications}
                      onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                    />
                    SMS notifications
                  </label>
                </div>

                <div className="preference-group">
                  <h3>Editor Settings</h3>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.autoSave}
                      onChange={(e) => handlePreferenceChange('autoSave', e.target.checked)}
                    />
                    Auto-save documents
                  </label>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.darkMode}
                      onChange={(e) => handlePreferenceChange('darkMode', e.target.checked)}
                    />
                    Dark mode
                  </label>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.showLineNumbers}
                      onChange={(e) => handlePreferenceChange('showLineNumbers', e.target.checked)}
                    />
                    Show line numbers
                  </label>
                </div>

                <div className="preference-group">
                  <h3>Editor Appearance</h3>
                  <div className="form-group">
                    <label htmlFor="fontSize">Font Size</label>
                    <input
                      type="range"
                      id="fontSize"
                      min="10"
                      max="24"
                      value={preferences.fontSize}
                      onChange={(e) => handlePreferenceChange('fontSize', parseInt(e.target.value))}
                    />
                    <span>{preferences.fontSize}px</span>
                  </div>
                  <div className="form-group">
                    <label htmlFor="tabSize">Tab Size</label>
                    <select
                      id="tabSize"
                      value={preferences.tabSize}
                      onChange={(e) => handlePreferenceChange('tabSize', parseInt(e.target.value))}
                    >
                      <option value={2}>2 spaces</option>
                      <option value={4}>4 spaces</option>
                      <option value={8}>8 spaces</option>
                    </select>
                  </div>
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={preferences.wordWrap}
                      onChange={(e) => handlePreferenceChange('wordWrap', e.target.checked)}
                    />
                    Word wrap
                  </label>
                </div>

                <button 
                  className="submit-btn"
                  onClick={() => preferencesService.applyTheme()}
                >
                  Apply Theme Changes
                </button>
              </div>
            ) : (
              <div>Failed to load preferences</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;