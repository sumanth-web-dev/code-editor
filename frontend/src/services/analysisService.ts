/**
 * Analysis service for GPT-powered code analysis and generation
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api';

export interface AnalysisRequest {
  code: string;
  language: string;
  explain_level: 'short' | 'medium' | 'long';
}

export interface GenerationRequest {
  prompt: string;
  language: string;
  explain_level: 'short' | 'medium' | 'long';
}

export interface CodeIssue {
  line: number;
  type: 'syntax' | 'logic' | 'style' | 'performance' | 'security';
  description: string;
  suggestion: string;
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
}

export interface LineExplanation {
  line: number;
  code: string;
  explanation: string;
}

export interface AnalysisResult {
  corrections: {
    has_issues: boolean;
    issues: CodeIssue[];
    corrected_code: string;
    diff: DiffLine[];
  };
  line_by_line_explanation: LineExplanation[];
  overall_explanation: string;
  real_world_example: string;
}

export interface GenerationResult {
  generated_code: string;
  explanation: string;
  line_by_line_explanation: LineExplanation[];
  usage_example: string;
  best_practices: string[];
}

export interface UsageInfo {
  session_id: string;
  analysis_count: number;
  generation_count: number;
  total_usage: number;
  free_trial_limit: number;
  remaining_free: number;
  is_premium: boolean;
  can_use_feature: boolean;
  reset_time_hours?: number;
  reset_time_minutes?: number;
  next_reset_ist?: string;
}

export interface GitDiffLine {
  line_number: number;
  content: string;
  type: 'added' | 'removed' | 'context';
}

export interface GitDiffData {
  has_changes: boolean;
  added_lines?: number;
  removed_lines?: number;
  diff_lines?: GitDiffLine[];
  message?: string;
  error?: string;
}

export interface GitStatusData {
  is_git_repo: boolean;
  files: { [filename: string]: string };
  has_changes: boolean;
}

export interface AnalysisResponse {
  success: boolean;
  analysis?: AnalysisResult;
  usage_info?: UsageInfo;
  git_diff?: GitDiffData;
  error?: string;
}

export interface GenerationResponse {
  success: boolean;
  generation?: GenerationResult;
  usage_info?: UsageInfo;
  error?: string;
}

export interface UsageResponse {
  success: boolean;
  usage_info?: UsageInfo;
  error?: string;
}

class AnalysisService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 60000, // 60 seconds for AI requests
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true, // Include session cookies
    });

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Analysis API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Analyze code using GPT API
   */
  async analyzeCode(request: AnalysisRequest): Promise<AnalysisResponse> {
    try {
      const response = await this.axiosInstance.post('/analyze', request);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        error: error.message || 'Failed to analyze code'
      };
    }
  }

  /**
   * Generate code using GPT API
   */
  async generateCode(request: GenerationRequest): Promise<GenerationResponse> {
    try {
      const response = await this.axiosInstance.post('/generate', request);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        error: error.message || 'Failed to generate code'
      };
    }
  }

  /**
   * Get usage information
   */
  async getUsageInfo(): Promise<UsageResponse> {
    try {
      const response = await this.axiosInstance.get('/usage');
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        error: error.message || 'Failed to get usage info'
      };
    }
  }

  /**
   * Upgrade to premium
   */
  async upgradeToPremium(): Promise<{ success: boolean; message?: string; error?: string; usage_info?: UsageInfo }> {
    try {
      console.log('Attempting to upgrade to premium...');
      console.log('API Base URL:', API_BASE_URL);
      
      const response = await this.axiosInstance.post('/upgrade', {}, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Upgrade response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Upgrade error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      
      if (error.response?.status === 404) {
        return {
          success: false,
          error: 'Upgrade endpoint not found. Please contact support.'
        };
      }
      
      if (error.response?.data) {
        console.error('Error response data:', error.response.data);
        return error.response.data;
      }
      
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          error: 'Request timeout. Please try again.'
        };
      }
      
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        return {
          success: false,
          error: 'Network error. Please check your connection and try again.'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to upgrade to premium'
      };
    }
  }

  /**
   * Get git diff for the current repository
   */
  async getGitDiff(filePath?: string, staged: boolean = false): Promise<{ success: boolean; git_diff?: GitDiffData; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (filePath) params.append('file_path', filePath);
      if (staged) params.append('staged', 'true');
      
      const response = await this.axiosInstance.get(`/git/diff?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        error: error.message || 'Failed to get git diff'
      };
    }
  }

  /**
   * Get git repository status
   */
  async getGitStatus(): Promise<{ success: boolean; git_status?: GitStatusData; error?: string }> {
    try {
      const response = await this.axiosInstance.get('/git/status');
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      return {
        success: false,
        error: error.message || 'Failed to get git status'
      };
    }
  }
}

export const analysisService = new AnalysisService();
export default analysisService;