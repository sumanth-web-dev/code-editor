import axios from 'axios';
import { 
  DashboardStats, 
  AdminUser, 
  UsersListResponse, 
  UserSubscription, 
  Payment 
} from '../types';
import { authService } from './authService';

// Configure base URL for API calls
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

const adminClient = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
adminClient.interceptors.request.use(
  (config) => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
adminClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const errorData = error.response?.data;
      if (errorData?.error_code === 'TOKEN_EXPIRED' || 
          (errorData?.error && errorData.error.includes('token') && errorData.error.includes('expire'))) {
        // Show user-friendly message for token expiry
        alert('Your session has expired. Please login again.');
        authService.logout();
        window.location.href = '/login';
      } else {
        // Generic unauthorized error
        authService.logout();
        window.location.href = '/login';
      }
    } else if (error.response?.status === 403) {
      // Insufficient permissions
      throw new Error('Access denied. Admin privileges required.');
    }
    return Promise.reject(error);
  }
);

class AdminService {
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await adminClient.get('/dashboard');
      
      if (response.data.success) {
        return response.data.dashboard;
      } else {
        throw new Error(response.data.error || 'Failed to get dashboard stats');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get dashboard stats');
    }
  }

  async getUsers(
    page: number = 1,
    perPage: number = 20,
    search?: string,
    role?: string,
    status?: string
  ): Promise<UsersListResponse> {
    try {
      const params: any = { page, per_page: perPage };
      if (search) params.search = search;
      if (role) params.role = role;
      if (status) params.status = status;

      const response = await adminClient.get('/users', { params });
      
      if (response.data.success) {
        return response.data;
      } else {
        throw new Error(response.data.error || 'Failed to get users');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get users');
    }
  }

  async getUserDetails(userId: number): Promise<AdminUser> {
    try {
      const response = await adminClient.get(`/users/${userId}`);
      
      if (response.data.success) {
        return response.data.user;
      } else {
        throw new Error(response.data.error || 'Failed to get user details');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get user details');
    }
  }

  async updateUser(userId: number, userData: Partial<AdminUser>): Promise<string> {
    try {
      const response = await adminClient.put(`/users/${userId}`, userData);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to update user');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update user');
    }
  }

  async getSubscriptions(
    page: number = 1,
    perPage: number = 20,
    status?: string,
    planId?: number,
    userEmail?: string
  ): Promise<{
    subscriptions: UserSubscription[];
    pagination: any;
    filters: any;
  }> {
    try {
      const params: any = { page, per_page: perPage };
      if (status) params.status = status;
      if (planId) params.plan_id = planId;
      if (userEmail) params.user_email = userEmail;

      const response = await adminClient.get('/subscriptions', { params });
      
      if (response.data.success) {
        return {
          subscriptions: response.data.subscriptions,
          pagination: response.data.pagination,
          filters: response.data.filters
        };
      } else {
        throw new Error(response.data.error || 'Failed to get subscriptions');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get subscriptions');
    }
  }

  async extendSubscription(subscriptionId: number, days: number, reason?: string): Promise<string> {
    try {
      const payload: any = { days };
      if (reason) payload.reason = reason;

      const response = await adminClient.post(`/subscriptions/${subscriptionId}/extend`, payload);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to extend subscription');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to extend subscription');
    }
  }

  async cancelSubscription(subscriptionId: number, reason?: string): Promise<string> {
    try {
      const payload: any = {};
      if (reason) payload.reason = reason;

      const response = await adminClient.post(`/subscriptions/${subscriptionId}/cancel`, payload);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to cancel subscription');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to cancel subscription');
    }
  }

  async getPayments(
    page: number = 1,
    perPage: number = 20,
    status?: string,
    gateway?: string,
    dateFrom?: string,
    dateTo?: string,
    userEmail?: string
  ): Promise<{
    payments: Payment[];
    pagination: any;
    filters: any;
  }> {
    try {
      const params: any = { page, per_page: perPage };
      if (status) params.status = status;
      if (gateway) params.gateway = gateway;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (userEmail) params.user_email = userEmail;

      const response = await adminClient.get('/payments', { params });
      
      if (response.data.success) {
        return {
          payments: response.data.payments,
          pagination: response.data.pagination,
          filters: response.data.filters
        };
      } else {
        throw new Error(response.data.error || 'Failed to get payments');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get payments');
    }
  }

  async processRefund(paymentId: number, amount?: number, reason?: string): Promise<string> {
    try {
      const payload: any = {};
      if (amount) payload.amount = amount;
      if (reason) payload.reason = reason;

      const response = await adminClient.post(`/payments/${paymentId}/refund`, payload);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to process refund');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to process refund');
    }
  }

  async getRevenueAnalytics(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'monthly',
    dateFrom?: string,
    dateTo?: string
  ): Promise<any> {
    try {
      const params: any = { period };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const response = await adminClient.get('/analytics/revenue', { params });
      
      if (response.data.success) {
        return response.data.analytics;
      } else {
        throw new Error(response.data.error || 'Failed to get revenue analytics');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get revenue analytics');
    }
  }

  async getDashboardAnalytics(): Promise<any> {
    try {
      const response = await adminClient.get('/analytics/dashboard');
      
      if (response.data.success) {
        return response.data.dashboard;
      } else {
        throw new Error(response.data.error || 'Failed to get dashboard analytics');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get dashboard analytics');
    }
  }

  async getAdminPlans(): Promise<any[]> {
    try {
      const response = await adminClient.get('/plans');
      
      if (response.data.success) {
        return response.data.plans;
      } else {
        throw new Error(response.data.error || 'Failed to get plans');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get plans');
    }
  }

  async createPlan(planData: any): Promise<string> {
    try {
      const response = await adminClient.post('/plans', planData);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to create plan');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to create plan');
    }
  }

  async updatePlan(planId: number, planData: any): Promise<string> {
    try {
      const response = await adminClient.put(`/plans/${planId}`, planData);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to update plan');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to update plan');
    }
  }

  async togglePlanStatus(planId: number): Promise<string> {
    try {
      const response = await adminClient.post(`/plans/${planId}/toggle`);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to toggle plan status');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to toggle plan status');
    }
  }

  async deletePlan(planId: number): Promise<string> {
    try {
      const response = await adminClient.delete(`/plans/${planId}`);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to delete plan');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to delete plan');
    }
  }

  async getStats(): Promise<DashboardStats> {
    return this.getDashboardStats();
  }

  async searchUsers(query: string): Promise<AdminUser[]> {
    try {
      const response = await this.getUsers(1, 50, query);
      return response.users;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to search users');
    }
  }

  async updateUserRole(userId: string, role: 'student' | 'editor' | 'admin'): Promise<void> {
    try {
      await this.updateUser(parseInt(userId), { role });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update user role');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const response = await adminClient.delete(`/users/${userId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete user');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to delete user');
    }
  }

  // Utility methods
  formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  convertToINR(amount: number, fromCurrency: string = 'USD'): number {
    // Simple conversion rate - in production, use real-time rates
    const conversionRates: Record<string, number> = {
      'USD': 83.0, // 1 USD = 83 INR (approximate)
      'EUR': 90.0, // 1 EUR = 90 INR (approximate)
      'INR': 1.0
    };
    
    return amount * (conversionRates[fromCurrency] || 1);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusColor(status: string): string {
    const statusColors: Record<string, string> = {
      active: '#10b981',
      completed: '#10b981',
      pending: '#f59e0b',
      expired: '#ef4444',
      cancelled: '#6b7280',
      failed: '#ef4444',
      refunded: '#8b5cf6',
    };
    return statusColors[status] || '#6b7280';
  }

  // System Logs Methods
  async getSystemLogs(filters: any = {}): Promise<any[]> {
    try {
      const params: any = {};
      if (filters.level) params.level = filters.level;
      if (filters.category) params.category = filters.category;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.limit) params.limit = filters.limit;

      const response = await adminClient.get('/logs/system', { params });
      
      if (response.data.success) {
        return response.data.logs;
      } else {
        throw new Error(response.data.error || 'Failed to get system logs');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get system logs');
    }
  }

  // Audit Logs Methods
  async getAuditLogs(filters: any = {}): Promise<any[]> {
    try {
      const params: any = {};
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.limit) params.limit = filters.limit;

      const response = await adminClient.get('/logs/audit', { params });
      
      if (response.data.success) {
        return response.data.logs;
      } else {
        throw new Error(response.data.error || 'Failed to get audit logs');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get audit logs');
    }
  }

  // Resource Usage Methods
  async getResourceUsage(): Promise<any[]> {
    try {
      const response = await adminClient.get('/resources/usage');
      
      if (response.data.success) {
        return response.data.usage;
      } else {
        throw new Error(response.data.error || 'Failed to get resource usage');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to get resource usage');
    }
  }

  // Clear Logs Methods
  async clearLogs(logType: string): Promise<string> {
    try {
      const response = await adminClient.delete(`/logs/${logType}`);
      
      if (response.data.success) {
        return response.data.message;
      } else {
        throw new Error(response.data.error || 'Failed to clear logs');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to clear logs');
    }
  }

  // Export Logs Methods
  async exportLogs(logType: string, filters: any = {}): Promise<any> {
    try {
      const params: any = {};
      if (filters.level) params.level = filters.level;
      if (filters.category) params.category = filters.category;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.limit) params.limit = filters.limit;

      const response = await adminClient.get(`/logs/${logType}/export`, { params });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Failed to export logs');
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Failed to export logs');
    }
  }
}

export const adminService = new AdminService();
export default adminService;