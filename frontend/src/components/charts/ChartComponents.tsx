import React from 'react';
import './ChartComponents.css';

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }[];
}

interface LineChartProps {
  data: ChartData;
  title: string;
  height?: number;
}

interface BarChartProps {
  data: ChartData;
  title: string;
  height?: number;
}

interface PieChartProps {
  data: {
    labels: string[];
    values: number[];
    colors: string[];
  };
  title: string;
}

interface DonutChartProps {
  data: {
    labels: string[];
    values: number[];
    colors: string[];
  };
  title: string;
  centerText?: string;
}

// Simple Line Chart Component
export const LineChart: React.FC<LineChartProps> = ({ data, title, height = 300 }) => {
  const maxValue = Math.max(...data.datasets[0].data);
  const minValue = Math.min(...data.datasets[0].data);
  const range = maxValue - minValue;
  
  const points = data.datasets[0].data.map((value, index) => {
    const x = (index / (data.labels.length - 1)) * 100;
    const y = 100 - ((value - minValue) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-wrapper" style={{ height }}>
        <svg viewBox="0 0 100 100" className="line-chart">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth="0.2"/>
          ))}
          
          {/* Area under curve */}
          <polygon
            points={`0,100 ${points} 100,100`}
            fill="url(#lineGradient)"
          />
          
          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Data points */}
          {data.datasets[0].data.map((value, index) => {
            const x = (index / (data.labels.length - 1)) * 100;
            const y = 100 - ((value - minValue) / range) * 100;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1"
                fill="#3b82f6"
                className="chart-point"
              />
            );
          })}
        </svg>
        
        {/* X-axis labels */}
        <div className="chart-labels">
          {data.labels.map((label, index) => (
            <span key={index} className="chart-label">
              {label}
            </span>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="chart-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#3b82f6' }}></div>
          <span>{data.datasets[0].label}</span>
        </div>
      </div>
    </div>
  );
};

// Simple Bar Chart Component
export const BarChart: React.FC<BarChartProps> = ({ data, title, height = 300 }) => {
  const maxValue = Math.max(...data.datasets[0].data);
  
  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="chart-wrapper" style={{ height }}>
        <div className="bar-chart">
          {data.datasets[0].data.map((value, index) => {
            const barHeight = (value / maxValue) * 100;
            return (
              <div key={index} className="bar-item">
                <div className="bar-container">
                  <div 
                    className="bar"
                    style={{ 
                      height: `${barHeight}%`,
                      backgroundColor: data.datasets[0].backgroundColor || '#3b82f6'
                    }}
                  >
                    <span className="bar-value">{value}</span>
                  </div>
                </div>
                <span className="bar-label">{data.labels[index]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Simple Pie Chart Component
export const PieChart: React.FC<PieChartProps> = ({ data, title }) => {
  const total = data.values.reduce((sum, value) => sum + value, 0);
  let currentAngle = 0;
  
  const slices = data.values.map((value, index) => {
    const percentage = (value / total) * 100;
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;
    
    const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M 50 50`,
      `L ${x1} ${y1}`,
      `A 40 40 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      'Z'
    ].join(' ');
    
    return {
      pathData,
      color: data.colors[index],
      label: data.labels[index],
      value,
      percentage: percentage.toFixed(1)
    };
  });
  
  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="pie-chart-wrapper">
        <svg viewBox="0 0 100 100" className="pie-chart">
          {slices.map((slice, index) => (
            <path
              key={index}
              d={slice.pathData}
              fill={slice.color}
              className="pie-slice"
            />
          ))}
        </svg>
        
        <div className="pie-legend">
          {slices.map((slice, index) => (
            <div key={index} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: slice.color }}></div>
              <span className="legend-text">
                {slice.label}: {slice.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Simple Donut Chart Component
export const DonutChart: React.FC<DonutChartProps> = ({ data, title, centerText }) => {
  const total = data.values.reduce((sum, value) => sum + value, 0);
  let currentAngle = 0;
  
  const slices = data.values.map((value, index) => {
    const percentage = (value / total) * 100;
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle += angle;
    
    const x1 = 50 + 35 * Math.cos((startAngle - 90) * Math.PI / 180);
    const y1 = 50 + 35 * Math.sin((startAngle - 90) * Math.PI / 180);
    const x2 = 50 + 35 * Math.cos((endAngle - 90) * Math.PI / 180);
    const y2 = 50 + 35 * Math.sin((endAngle - 90) * Math.PI / 180);
    
    const x3 = 50 + 20 * Math.cos((endAngle - 90) * Math.PI / 180);
    const y3 = 50 + 20 * Math.sin((endAngle - 90) * Math.PI / 180);
    const x4 = 50 + 20 * Math.cos((startAngle - 90) * Math.PI / 180);
    const y4 = 50 + 20 * Math.sin((startAngle - 90) * Math.PI / 180);
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${x1} ${y1}`,
      `A 35 35 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A 20 20 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');
    
    return {
      pathData,
      color: data.colors[index],
      label: data.labels[index],
      value,
      percentage: percentage.toFixed(1)
    };
  });
  
  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="donut-chart-wrapper">
        <div className="donut-chart-container">
          <svg viewBox="0 0 100 100" className="donut-chart">
            {slices.map((slice, index) => (
              <path
                key={index}
                d={slice.pathData}
                fill={slice.color}
                className="donut-slice"
              />
            ))}
          </svg>
          
          {centerText && (
            <div className="donut-center">
              <span className="center-text">{centerText}</span>
            </div>
          )}
        </div>
        
        <div className="donut-legend">
          {slices.map((slice, index) => (
            <div key={index} className="legend-item">
              <div className="legend-color" style={{ backgroundColor: slice.color }}></div>
              <span className="legend-text">
                {slice.label}: {slice.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Stats Card with Trend
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon?: string;
  color?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  change, 
  icon, 
  color = '#3b82f6' 
}) => {
  return (
    <div className="stats-card">
      <div className="stats-card-header">
        {icon && (
          <div className="stats-icon" style={{ backgroundColor: `${color}20`, color }}>
            {icon}
          </div>
        )}
        <div className="stats-content">
          <h3 className="stats-title">{title}</h3>
          <div className="stats-value">{value}</div>
          {change && (
            <div className={`stats-change ${change.type}`}>
              <span className="change-indicator">
                {change.type === 'increase' ? '↗' : '↘'}
              </span>
              <span className="change-value">
                {Math.abs(change.value)}% {change.period}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Activity Timeline Component
interface ActivityItem {
  id: string;
  type: 'user' | 'payment' | 'subscription' | 'system';
  title: string;
  description: string;
  timestamp: string;
  user?: string;
  amount?: number;
}

interface ActivityTimelineProps {
  activities: ActivityItem[];
  title: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities, title }) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user': return '👤';
      case 'payment': return '💳';
      case 'subscription': return '📋';
      case 'system': return '⚙️';
      default: return '📌';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user': return '#10b981';
      case 'payment': return '#f59e0b';
      case 'subscription': return '#3b82f6';
      case 'system': return '#6b7280';
      default: return '#8b5cf6';
    }
  };

  return (
    <div className="activity-timeline">
      <h3 className="timeline-title">{title}</h3>
      <div className="timeline-container">
        {activities.map((activity, index) => (
          <div key={activity.id} className="timeline-item">
            <div 
              className="timeline-marker"
              style={{ backgroundColor: getActivityColor(activity.type) }}
            >
              {getActivityIcon(activity.type)}
            </div>
            <div className="timeline-content">
              <div className="timeline-header">
                <h4 className="timeline-title">{activity.title}</h4>
                <span className="timeline-time">
                  {new Date(activity.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="timeline-description">{activity.description}</p>
              {activity.user && (
                <span className="timeline-user">by {activity.user}</span>
              )}
              {activity.amount && (
                <span className="timeline-amount">${activity.amount}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};