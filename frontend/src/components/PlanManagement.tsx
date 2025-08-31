import React, { useState, useEffect } from 'react';
import { SubscriptionPlan } from '../types';
import { paymentService } from '../services/paymentService';
import { adminService } from '../services/adminService';

interface PlanManagementProps {
  onPlanUpdate?: () => void;
}

const PlanManagement: React.FC<PlanManagementProps> = ({ onPlanUpdate }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    interval: 'month',
    executionLimit: 100,
    storageLimit: 1024,
    features: [''],
    is_active: true
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const plansData = await paymentService.getSubscriptionPlans();
      setPlans(plansData);
    } catch (error) {
      console.error('Failed to load plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setFormData({
      name: '',
      description: '',
      price: 0,
      interval: 'month',
      executionLimit: 100,
      storageLimit: 1024,
      features: [''],
      is_active: true
    });
    setEditingPlan(null);
    setShowCreateModal(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      interval: plan.interval,
      executionLimit: plan.executionLimit || 0,
      storageLimit: plan.storageLimit || 0,
      features: plan.features.length > 0 ? plan.features : [''],
      is_active: plan.is_active || true
    });
    setEditingPlan(plan);
    setShowCreateModal(true);
  };

  const handleSavePlan = async () => {
    try {
      const planData = {
        ...formData,
        features: formData.features.filter(f => f.trim() !== '')
      };

      if (editingPlan) {
        // Update existing plan
        console.log('Updating plan:', editingPlan.id, planData);
        // In a real implementation, call API to update plan
        alert('Plan updated successfully');
      } else {
        // Create new plan
        console.log('Creating new plan:', planData);
        // In a real implementation, call API to create plan
        alert('Plan created successfully');
      }

      setShowCreateModal(false);
      loadPlans();
      onPlanUpdate?.();
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Failed to save plan');
    }
  };

  const handleTogglePlanStatus = async (plan: SubscriptionPlan) => {
    try {
      console.log('Toggling plan status:', plan.id, !plan.is_active);
      // In a real implementation, call API to toggle plan status
      alert(`Plan ${plan.is_active ? 'deactivated' : 'activated'} successfully`);
      loadPlans();
      onPlanUpdate?.();
    } catch (error) {
      console.error('Failed to toggle plan status:', error);
      alert('Failed to update plan status');
    }
  };

  const handleDeletePlan = async (plan: SubscriptionPlan) => {
    if (!window.confirm(`Are you sure you want to delete the "${plan.name}" plan?`)) {
      return;
    }

    try {
      console.log('Deleting plan:', plan.id);
      // In a real implementation, call API to delete plan
      alert('Plan deleted successfully');
      loadPlans();
      onPlanUpdate?.();
    } catch (error) {
      console.error('Failed to delete plan:', error);
      alert('Failed to delete plan');
    }
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, '']
    });
  };

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features];
    newFeatures[index] = value;
    setFormData({
      ...formData,
      features: newFeatures
    });
  };

  const removeFeature = (index: number) => {
    const newFeatures = formData.features.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      features: newFeatures.length > 0 ? newFeatures : ['']
    });
  };

  if (loading) {
    return <div className="loading">Loading plans...</div>;
  }

  return (
    <div className="plan-management">
      <div className="plan-management-header">
        <h3>Subscription Plans Management</h3>
        <button className="btn primary" onClick={handleCreatePlan}>
          Create New Plan
        </button>
      </div>

      <div className="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} className="plan-card admin">
            <div className="plan-header">
              <h4>{plan.name}</h4>
              <span className={`plan-status ${plan.is_active ? 'active' : 'inactive'}`}>
                {plan.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div className="plan-details">
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price">
                <span className="price">${plan.price}</span>
                <span className="interval">/{plan.interval}</span>
              </div>
              <div className="plan-limits">
                <p>Execution Limit: {plan.executionLimit}</p>
                <p>Storage Limit: {plan.storageLimit} MB</p>
              </div>
              <div className="plan-features">
                <h5>Features:</h5>
                <ul>
                  {plan.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
            
            <div className="plan-actions">
              <button 
                className="action-btn edit"
                onClick={() => handleEditPlan(plan)}
              >
                Edit
              </button>
              <button 
                className={`action-btn ${plan.is_active ? 'deactivate' : 'activate'}`}
                onClick={() => handleTogglePlanStatus(plan)}
              >
                {plan.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button 
                className="action-btn delete"
                onClick={() => handleDeletePlan(plan)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Plan Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal large">
            <div className="modal-header">
              <h3>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Plan Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter plan name"
                  />
                </div>
                
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Enter plan description"
                  />
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Price ($)</label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Billing Interval</label>
                    <select
                      value={formData.interval}
                      onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                    >
                      <option value="day">Daily</option>
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Execution Limit</label>
                    <input
                      type="number"
                      value={formData.executionLimit}
                      onChange={(e) => setFormData({ ...formData, executionLimit: parseInt(e.target.value) })}
                      min="0"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Storage Limit (MB)</label>
                    <input
                      type="number"
                      value={formData.storageLimit}
                      onChange={(e) => setFormData({ ...formData, storageLimit: parseInt(e.target.value) })}
                      min="0"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Features</label>
                  {formData.features.map((feature, index) => (
                    <div key={index} className="feature-input">
                      <input
                        type="text"
                        value={feature}
                        onChange={(e) => updateFeature(index, e.target.value)}
                        placeholder="Enter feature"
                      />
                      {formData.features.length > 1 && (
                        <button
                          type="button"
                          className="remove-feature-btn"
                          onClick={() => removeFeature(index)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-feature-btn"
                    onClick={addFeature}
                  >
                    Add Feature
                  </button>
                </div>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    Active Plan
                  </label>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn cancel" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn primary" onClick={handleSavePlan}>
                {editingPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanManagement;