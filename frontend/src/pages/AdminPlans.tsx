import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { authService } from '../services/authService';
import './AdminPlans.css';

// Define the Plan interface for type safety
interface Plan {
  id: number;
  name: string;
  price: number;
  currency: string;
  is_active: boolean;
  features: {
    features: string[];
    [key: string]: any;
  };
  [key: string]: any;
}

const AdminPlans: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  
  // Initialize form state with a more robust structure
  const initialFormState = {
    name: '',
    description: '',
    price: 0,
    currency: 'INR',
    interval: 'month',
    executionLimit: 0,
    aiAnalysisLimit: 0,
    features: [],
    is_active: true,
  };
  const [form, setForm] = useState<any>(initialFormState);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = authService.getAccessToken();
      const res = await axios.get('/api/admin/plans', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setPlans(res.data.plans || []);
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleEdit = (plan: Plan) => {
    try {
      setEditingPlan(plan);
      // Correctly populate form, handling the nested features array
      let featuresArray: string[] = [];
      if (Array.isArray(plan.features)) {
        featuresArray = plan.features;
      } else if (plan.features && typeof plan.features === 'object' && Array.isArray(plan.features.features)) {
        featuresArray = plan.features.features;
      }
      
      setForm({
        ...plan,
        price: plan.price_per_unit || plan.price || 0,
        interval: plan.plan_type || plan.interval_type || 'month',
        features: featuresArray,
        executionLimit: plan.execution_limit || 0,
        aiAnalysisLimit: plan.ai_analysis_limit || 0,
        storageLimit: plan.storage_limit || 0,
      });
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Error editing plan:', err);
      setError('Failed to edit plan');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this plan? This action can be destructive.')) return;
    try {
      const token = authService.getAccessToken();
      const response = await axios.delete(`/api/admin/plans/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setError(null);
        fetchPlans(); // Refresh plans list
      } else {
        setError(response.data.error || 'Failed to delete plan');
      }
    } catch (err: any) {
      console.error('Error deleting plan:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to delete plan');
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      const token = authService.getAccessToken();
      const response = await axios.post(`/api/admin/plans/${id}/toggle`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        setError(null);
        fetchPlans(); // Refresh plans list
      } else {
        setError(response.data.error || 'Failed to toggle plan status');
      }
    } catch (err: any) {
      console.error('Error toggling plan status:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to toggle plan status');
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    if (name === 'features') {
      setForm((prev: any) => ({ ...prev, features: value.split(',').map(f => f.trim()) }));
    } else {
      setForm((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prepare payload, ensuring features are correctly structured
    const payload = {
      ...form,
      features: form.features, // The form state for features is already an array
    };

    try {
      const token = authService.getAccessToken();
      const config = {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      let response;
      if (editingPlan) {
        response = await axios.put(`/api/admin/plans/${editingPlan.id}`, payload, config);
      } else {
        response = await axios.post('/api/admin/plans', payload, config);
      }
      
      if (response.data.success) {
        setError(null);
        setEditingPlan(null);
        setForm(initialFormState);
        fetchPlans(); // Refresh plans
      } else {
        setError(response.data.error || 'Failed to save plan');
      }
    } catch (err: any) {
      console.error('Error saving plan:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to save plan');
    }
  };

  // Add a safeguard to ensure features is always an array
  const renderPlanCard = (plan: Plan) => {
    // Parse price safely
    const price = Number(plan.price_per_unit ?? plan.price);
    // Handle features properly - check if it's nested in features object
    let featuresArray: string[] = [];
    if (Array.isArray(plan.features)) {
      featuresArray = plan.features;
    } else if (plan.features && typeof plan.features === 'object' && Array.isArray(plan.features.features)) {
      featuresArray = plan.features.features;
    }
    
    return (
      <div key={plan.id} className={`plan-card ${plan.is_active ? 'active' : 'inactive'}`}>
        <div className="plan-card-header">
          <div className="plan-title">
            <h4>{plan.name}</h4>
            <span className={`plan-status ${plan.is_active ? 'active' : 'inactive'}`}>
              {plan.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="plan-price">
            <span className="currency">{plan.currency || 'INR'}</span>
            <span className="amount">{isNaN(price) ? '0' : price}</span>
            <span className="interval">/{plan.plan_type || plan.interval_type || 'month'}</span>
          </div>
        </div>
        
        <div className="plan-card-body">
          <p className="plan-description">{plan.description || 'No description provided'}</p>
          
          <div className="plan-features">
            <h5>Features:</h5>
            {featuresArray.length > 0 ? (
              <ul>
                {featuresArray.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            ) : (
              <p className="no-features">No features defined</p>
            )}
          </div>
        </div>
        
        <div className="plan-card-actions">
          <button className="btn-edit" onClick={() => handleEdit(plan)}>
            Edit Plan
          </button>
          <button 
            className={`btn-toggle ${plan.is_active ? 'deactivate' : 'activate'}`}
            onClick={() => handleToggleActive(plan.id)}
          >
            {plan.is_active ? 'Deactivate' : 'Activate'}
          </button>
          <button className="btn-delete" onClick={() => handleDelete(plan.id)}>
            Delete
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="admin-plans-container">
      <div className="plans-header">
        <h1>Subscription Plans Management</h1>
        <p>Create and manage subscription plans that will be available to users</p>
      </div>
      
      {error && <div className="error-message">{error}</div>}

      <div className="plan-form-section">
        <h3>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
        <p className="form-description">
          {editingPlan ? 'Modify the selected plan details' : 'Create a new subscription plan for users'}
        </p>
        <form onSubmit={handleSubmit} className="plan-form">
        <input name="name" value={form.name} onChange={handleFormChange} placeholder="Plan Name" required />
        <textarea name="description" value={form.description} onChange={handleFormChange} placeholder="Description" />
        <input name="price" type="number" value={form.price} onChange={handleFormChange} placeholder="Price" required />
        <select name="interval" value={form.interval} onChange={handleFormChange}>
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
          <option value="day">Daily</option>
        </select>
        <input name="executionLimit" type="number" value={form.executionLimit} onChange={handleFormChange} placeholder="Execution Limit" />
        <input name="aiAnalysisLimit" type="number" value={form.aiAnalysisLimit} onChange={handleFormChange} placeholder="AI Analysis Limit" />
        <input name="features" value={Array.isArray(form.features) ? form.features.join(', ') : ''} onChange={handleFormChange} placeholder="Features (comma-separated)" />
        <label>
          <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleFormChange} />
          Active
        </label>
        <div className="form-actions">
          <button type="submit">{editingPlan ? 'Update Plan' : 'Create Plan'}</button>
          {editingPlan && <button type="button" onClick={() => { setEditingPlan(null); setForm(initialFormState); }}>Cancel</button>}
        </div>
        </form>
      </div>

      <div className="plans-list-section">
        <div className="section-header">
          <h3>All Subscription Plans</h3>
          <div className="plans-stats">
            <span className="stat">Total: {plans.length}</span>
            <span className="stat">Active: {plans.filter(p => p.is_active).length}</span>
            <span className="stat">Inactive: {plans.filter(p => !p.is_active).length}</span>
          </div>
        </div>
        
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading plans...</p>
          </div>
        ) : (
          <div className="plans-grid">
            {plans.map(renderPlanCard)}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPlans;
