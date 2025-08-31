// Core types for the multi-language code editor

export interface Language {
  id: string;
  name: string;
  version: string;
  fileExtension: string;
  syntaxHighlighting: string;
  executionCommand: string;
  dockerImage?: string;
}

export interface ExecutionRequest {
  language: string;
  code: string;
  input?: string;
  timeout?: number;
}

export interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
  memoryUsage?: number;
}

export interface EditorState {
  currentLanguage: string;
  code: string;
  output: string;
  isExecuting: boolean;
  error?: string;
  mode: 'execution' | 'preview';
}

export interface ApiError {
  type: string;
  message: string;
  line?: number;
  details?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

// Component prop interfaces
export interface CodeEditorProps {
  language: string;
  code: string;
  onChange: (code: string) => void;
  onRun: () => void;
}

export interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
  supportedLanguages: Language[];
}

export interface OutputWindowProps {
  output: string;
  isLoading: boolean;
  error?: string;
}

export interface PreviewWindowProps {
  html: string;
  css: string;
  javascript: string;
}

// Authentication & User Management Types
export interface User {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  role: 'student' | 'admin' | 'editor';
  isActive?: boolean;
  is_active?: boolean;
  email_verified?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  last_login?: string;
  profile_picture_url?: string;
  phone?: string;
  company?: string;
  bio?: string;
  country?: string;
  timezone?: string;
  preferences?: {
    emailNotifications?: boolean;
    marketingEmails?: boolean;
    smsNotifications?: boolean;
    autoSave?: boolean;
    darkMode?: boolean;
    showLineNumbers?: boolean;
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: 'student' | 'editor';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  tokens: AuthTokens;
  session: UserSession;
}

export interface UserSession {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: string;
  created_at: string;
  last_accessed: string;
  is_active: boolean;
  ip_address?: string;
}

// Payment & Subscription Types
export interface SubscriptionPlan {
  id: string | number;
  name: string;
  description: string;
  plan_type?: 'daily' | 'monthly' | 'yearly' | 'custom';
  interval: string;
  price: number;
  price_per_unit?: number;
  currency: string;
  features: string[];
  executionLimit?: number;
  storageLimit?: number;
  aiAnalysisLimit?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled' | 'suspended';
  auto_renew: boolean;
  custom_duration_days?: number;
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  is_active: boolean;
  is_expired: boolean;
  days_remaining: number;
  plan?: SubscriptionPlan;
  // Add aliases for compatibility
  createdAt?: string;
  expiresAt?: string;
  amount?: number;
  planId?: number;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired';
  amount: number;
  currentPeriodEnd: string;
  createdAt: string;
}

export interface Payment {
  id: number;
  user_id: number;
  subscription_id?: number;
  payment_gateway: string;
  gateway_transaction_id?: string;
  gateway_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
  payment_method?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  failed_reason?: string;
  subscription?: UserSubscription;
}

export interface CostCalculation {
  plan_id: number;
  total_cost: number;
  currency: string;
  duration_days: number;
  start_date?: string;
  end_date?: string;
}

export interface PaymentData {
  subscription_id?: number;
  payment_id?: number;
  status?: string;
  payment_url?: string;
  subscription?: UserSubscription;
  payment?: Payment;
  gateway_data?: {
    payment_intent_id: string;
    client_secret?: string;
    gateway: string;
  };
}

// Admin Panel Types
export interface DashboardStats {
  total_users: number;
  active_subscriptions: number;
  total_revenue: number;
  monthly_revenue: number;
  new_users_today: number;
  new_subscriptions_today: number;
  revenue_today: number;
  top_plans: Array<{
    plan_name: string;
    subscribers: number;
    revenue: number;
  }>;
  recent_activity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export interface AdminStats {
  totalUsers: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  totalRevenue: number;
  totalExecutions: number;
  newUsersThisMonth: number;
  newSubscriptionsThisMonth: number;
  revenueGrowth: number;
  executionsToday: number;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export interface AdminUser extends User {
  subscription_status?: string;
  subscription_plan?: string;
  usage_stats?: {
    total_executions: number;
    total_ai_analyses: number;
    favorite_languages: string[];
    last_activity: string;
  };
  plans?: {
    id: number;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
  }[];
}

export interface PaginationInfo {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface UsersListResponse {
  success: boolean;
  users: AdminUser[];
  pagination: PaginationInfo;
  filters: {
    search?: string;
    role?: string;
    status?: string;
  };
}

// Application State Types
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  error: string | null;
}

export interface PaymentState {
  plans: SubscriptionPlan[];
  userSubscriptions: UserSubscription[];
  activeSubscription: UserSubscription | null;
  loading: boolean;
  error: string | null;
}

export interface AdminState {
  dashboard: DashboardStats | null;
  users: AdminUser[];
  subscriptions: UserSubscription[];
  payments: Payment[];
  loading: boolean;
  error: string | null;
}// Usage Statistics
export interface UsageStats {
  documentsCreated: number;
  aiRequests: number;
  storageUsed: number;
  totalExecutions?: number;
  favoriteLanguages?: string[];
  lastActivity?: string;
}