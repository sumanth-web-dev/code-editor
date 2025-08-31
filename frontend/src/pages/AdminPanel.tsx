import React, { useState } from 'react';
import AdminPlans from './AdminPlans';
import AdminLogsResources from './AdminLogsResources';
import AdminUsers from './AdminUsers';
import './AdminPanel.css';

const AdminPanel: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'plans' | 'users' | 'logs-resources'>('plans');

  return (
    <div className="admin-panel">
      <div className="admin-sidebar">
        <div className="admin-logo">
          <h2>Admin Panel</h2>
          <p>System Management</p>
        </div>
        
        <nav className="admin-nav">
          <button
            className={`nav-item ${activeSection === 'plans' ? 'active' : ''}`}
            onClick={() => setActiveSection('plans')}
          >
            <span className="nav-icon">📋</span>
            <span className="nav-text">Subscription Plans</span>
          </button>
          
          <button
            className={`nav-item ${activeSection === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSection('users')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-text">User Management</span>
          </button>
          
          <button
            className={`nav-item ${activeSection === 'logs-resources' ? 'active' : ''}`}
            onClick={() => setActiveSection('logs-resources')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Logs & Resources</span>
          </button>
        </nav>
      </div>

      <div className="admin-main">
        {activeSection === 'plans' && <AdminPlans />}
        {activeSection === 'users' && <AdminUsers />}
        {activeSection === 'logs-resources' && <AdminLogsResources />}
      </div>
    </div>
  );
};

export default AdminPanel;