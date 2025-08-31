/**
 * Service for managing user preferences
 */

export interface UserPreferences {
  emailNotifications: boolean;
  marketingEmails: boolean;
  smsNotifications: boolean;
  autoSave: boolean;
  darkMode: boolean;
  showLineNumbers: boolean;
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
}

class PreferencesService {
  private readonly STORAGE_KEY = 'user_preferences';
  private defaultPreferences: UserPreferences = {
    emailNotifications: true,
    marketingEmails: false,
    smsNotifications: false,
    autoSave: true,
    darkMode: false,
    showLineNumbers: true,
    theme: 'light',
    fontSize: 14,
    tabSize: 2,
    wordWrap: true
  };

  async getPreferences(): Promise<UserPreferences> {
    try {
      // Try to get from backend first
      const response = await fetch('/api/user/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return { ...this.defaultPreferences, ...data.preferences };
      }
    } catch (error) {
      console.warn('Failed to load preferences from backend, using local storage');
    }

    // Fallback to local storage
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...this.defaultPreferences, ...parsed };
      } catch (error) {
        console.error('Failed to parse stored preferences:', error);
      }
    }

    return this.defaultPreferences;
  }

  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const currentPrefs = await this.getPreferences();
    const updatedPrefs = { ...currentPrefs, ...preferences };

    try {
      // Try to save to backend first
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preferences: updatedPrefs })
      });

      if (!response.ok) {
        throw new Error('Failed to save to backend');
      }
    } catch (error) {
      console.warn('Failed to save preferences to backend, using local storage');
    }

    // Always save to local storage as backup
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedPrefs));
  }

  async resetPreferences(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
    
    try {
      await fetch('/api/user/preferences', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.warn('Failed to reset preferences on backend');
    }
  }

  // Get specific preference
  async getPreference<K extends keyof UserPreferences>(key: K): Promise<UserPreferences[K]> {
    const preferences = await this.getPreferences();
    return preferences[key];
  }

  // Set specific preference
  async setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): Promise<void> {
    await this.savePreferences({ [key]: value } as Partial<UserPreferences>);
  }

  // Apply theme preferences to document
  async applyTheme(): Promise<void> {
    const preferences = await this.getPreferences();
    const root = document.documentElement;
    
    if (preferences.darkMode || preferences.theme === 'dark') {
      root.classList.add('dark-theme');
    } else {
      root.classList.remove('dark-theme');
    }

    root.style.setProperty('--editor-font-size', `${preferences.fontSize}px`);
  }
}

export const preferencesService = new PreferencesService();
export default preferencesService;