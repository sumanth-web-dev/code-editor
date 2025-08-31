import React, { useState, useEffect } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { formatDate } from '../utils/dataTransformers';
import { getErrorMessage } from '../utils/errorUtils';
import './AdminUsers.css';

const AdminUsers: React.FC = () => {
  const {
    users,
    loading,
    error,
    searchUsers,
    updateUserRole,
    deleteUser
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      try {
        await searchUsers(searchQuery);
      } catch (error) {
        console.error('Search failed:', error);
      }
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: 'student' | 'editor' | 'admin') => {
    try {
      await updateUserRole(userId, newRole);
      alert('User role updated successfully');
    } catch (error) {
      console.error('Role update failed:', error);
      alert('Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await deleteUser(userId);
        alert('User deleted successfully');
      } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete user');
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesRole = !selectedRole || user.role === selectedRole;
    const matchesStatus = !selectedStatus || 
      (selectedStatus === 'active' && user.is_active) ||
      (selectedStatus === 'inactive' && !user.is_active);
    return matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="admin-users-loading">
        <div className="loading-spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-users-error">
        <h3>Error Loading Users</h3>
        <p>{getErrorMessage(error)}</p>
      </div>
    );
  }

  return (
    <div className="admin-users">
      <div className="users-header">
        <h1>User Management</h1>
        <p>Manage user accounts, roles, and permissions</p>
      </div>

      <div className="users-controls">
        <div className="search-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="search-btn" onClick={handleSearch}>
              Search
            </button>
          </div>
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <label>Role:</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="">All Roles</option>
              <option value="student">Student</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      <div className="users-stats">
        <div className="stat-card">
          <div className="stat-number">{users.length}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{users.filter(u => u.is_active).length}</div>
          <div className="stat-label">Active Users</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{users.filter(u => u.role === 'admin').length}</div>
          <div className="stat-label">Admins</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{users.filter(u => u.email_verified).length}</div>
          <div className="stat-label">Verified</div>
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Verified</th>
              <th>Subscriptions</th>
              <th>Created</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className={!user.is_active ? 'user-inactive' : ''}>
                <td className="user-info">
                  <div className="user-avatar">
                    {user.profile_picture_url ? (
                      <img src={user.profile_picture_url} alt="Avatar" />
                    ) : (
                      <div className="avatar-placeholder">
                        {(user.first_name?.[0] || user.name?.[0] || user.email[0]).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="user-details">
                    <div className="user-name">
                      {user.name || `${user.first_name} ${user.last_name}`}
                    </div>
                    <div className="user-id">ID: {user.id}</div>
                  </div>
                </td>
                <td className="user-email">{user.email}</td>
                <td>
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleUpdate(user.id, e.target.value as 'student' | 'editor' | 'admin')}
                    className={`role-select role-${user.role}`}
                  >
                    <option value="student">Student</option>
                    <option value="editor">Editor</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <span className={`verification-badge ${user.email_verified ? 'verified' : 'unverified'}`}>
                    {user.email_verified ? '✓ Verified' : '✗ Unverified'}
                  </span>
                </td>
                <td>
                  <div className="user-subscriptions">
                    {user.plans && user.plans.length > 0 ? (
                      user.plans.map((plan: any, index: number) => (
                        <div key={index} className={`subscription-badge ${plan.status}`}>
                          {plan.name}
                        </div>
                      ))
                    ) : (
                      <span className="no-subscriptions">No active plans</span>
                    )}
                  </div>
                </td>
                <td className="date-cell">
                  {user.created_at ? formatDate(user.created_at) : 'N/A'}
                </td>
                <td className="date-cell">
                  {user.last_login ? formatDate(user.last_login) : 'Never'}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="btn-action btn-delete"
                      onClick={() => handleDeleteUser(user.id)}
                      title="Delete User"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="no-users">
            <p>No users found matching the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsers;