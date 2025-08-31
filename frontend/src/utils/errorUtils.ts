import React from 'react';

/**
 * Utility functions for handling and displaying errors safely
 */

/**
 * Safely converts an error to a string for display
 * @param error - The error to convert (can be string, Error object, or any other type)
 * @returns A string representation of the error
 */
export const getErrorMessage = (error: any): string => {
  if (!error) return 'An unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error instanceof Error) return error.message;
  
  if (typeof error === 'object') {
    // Try to extract meaningful error information from objects
    if (error.message) return error.message;
    if (error.error) return error.error;
    if (error.details) return error.details;
    
    // If it's a response object with data
    if (error.response?.data?.error) return error.response.data.error;
    if (error.response?.data?.message) return error.response.data.message;
    
    // Last resort: stringify the object
    try {
      return JSON.stringify(error);
    } catch {
      return 'An error occurred (unable to display details)';
    }
  }
  
  return String(error);
};

/**
 * Component for safely displaying errors
 */
export const ErrorDisplay: React.FC<{ error: any; prefix?: string }> = ({ error, prefix = 'Error: ' }) => {
  return React.createElement(React.Fragment, null, prefix, getErrorMessage(error));
};