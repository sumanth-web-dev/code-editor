import { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import { UserSubscription, DashboardStats, AdminUser } from '../types';

interface UseAdminReturn {
  stats: DashboardStats;
  users: AdminUser[];
  subscriptions: UserSubscription[];
  loading: boolean;
  error: string | null;
  searchUsers: (query: string) => Promise<AdminUser[]>;
  updateUserRole: (userId: string, role: 'student' | 'editor' | 'admin') => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useAdmin = (): UseAdminReturn => {
  const [stats, setStats] = useState<DashboardStats>({
    total_users: 0,
    active_subscriptions: 0,
    total_revenue: 0,
    monthly_revenue: 0,
    new_users_today: 0,
    new_subscriptions_today: 0,
    revenue_today: 0,
    top_plans: [],
    recent_activity: []
  });
  
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, usersData, subscriptionsData] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers(),
        adminService.getSubscriptions()
      ]);

      setStats(statsData);
      setUsers(usersData.users);
      setSubscriptions(subscriptionsData.subscriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin data');
      console.error('Admin data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string): Promise<AdminUser[]> => {
    try {
      const results = await adminService.searchUsers(query);
      return results;
    } catch (err) {
      console.error('User search error:', err);
      return [];
    }
  };

  const updateUserRole = async (userId: string, role: 'student' | 'editor' | 'admin'): Promise<void> => {
    try {
      await adminService.updateUserRole(userId, role);
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, role } : user
        )
      );
    } catch (err) {
      console.error('Update user role error:', err);
      throw err;
    }
  };

  const deleteUser = async (userId: string): Promise<void> => {
    try {
      await adminService.deleteUser(userId);
      
      // Update local state
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      
      // Update stats
      setStats(prevStats => ({
        ...prevStats,
        total_users: prevStats.total_users - 1
      }));
    } catch (err) {
      console.error('Delete user error:', err);
      throw err;
    }
  };

  const refreshData = async (): Promise<void> => {
    await fetchAdminData();
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  return {
    stats,
    users,
    subscriptions,
    loading,
    error,
    searchUsers,
    updateUserRole,
    deleteUser,
    refreshData
  };
};