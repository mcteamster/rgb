import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../constants/regions';

interface NotificationProps {
  region: string;
  errors?: string[];
  onClearError?: (index: number) => void;
}

interface Notice {
  message?: string;
  regions?: string[];
}

export const Notification: React.FC<NotificationProps> = ({ region, errors = [], onClearError }) => {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissedNotices, setDismissedNotices] = useState<Set<string>>(new Set());

  const checkNotices = useCallback(async () => {
    try {
      const data = await (await fetch(`${API_BASE_URL}/common/notices/rgb`)).json();
      // Handle both single notice and array of notices
      const noticeArray = Array.isArray(data) ? data : [data];
      setNotices(noticeArray.filter(notice => notice.message));
    } catch (err) {
      console.warn('Error fetching notices', err);
    }
  }, []);
  
  useEffect(() => {
    checkNotices();
  }, [checkNotices]);

  // Auto-dismiss errors after 3 seconds
  useEffect(() => {
    if (errors.length > 0) {
      const timer = setTimeout(() => {
        // Clear all errors by calling onClearError for each error index
        errors.forEach((_, index) => onClearError?.(index));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [errors, onClearError]);

  // Auto-dismiss notices after 3 seconds
  useEffect(() => {
    const applicableNotices = notices.filter(notice => 
      notice.message &&
      (!notice.regions || notice.regions.length === 0 || notice.regions.includes(region)) &&
      !dismissedNotices.has(notice.message)
    );

    if (applicableNotices.length > 0) {
      const timer = setTimeout(() => {
        applicableNotices.forEach(notice => {
          setDismissedNotices(prev => new Set([...prev, notice.message!]));
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notices, region, dismissedNotices]);

  const applicableNotices = notices.filter(notice => 
    notice.message &&
    (!notice.regions || notice.regions.length === 0 || notice.regions.includes(region)) &&
    !dismissedNotices.has(notice.message)
  );

  const dismissNotice = (message: string) => {
    setDismissedNotices(prev => new Set([...prev, message]));
  };

  return (
    <div>
      {errors.map((error, index) => (
        <div key={`error-${index}`} className="error" onClick={() => onClearError?.(index)}>
          {error}
        </div>
      ))}
      {applicableNotices.map((notice, index) => (
        <div key={`notice-${index}`} style={{
          background: 'white',
          color: '#333',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1rem',
          textAlign: 'center',
          border: '1px solid #ddd',
          cursor: 'pointer'
        }} onClick={() => dismissNotice(notice.message!)}>
          {notice.message}
        </div>
      ))}
    </div>
  );
};
