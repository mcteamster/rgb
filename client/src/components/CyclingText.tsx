import React from 'react';

interface CyclingTextProps {
  text: string;
  exiting: boolean;
  style?: React.CSSProperties;
}

export const CyclingText: React.FC<CyclingTextProps> = ({ text, exiting, style }) => (
  <>
    <span
      key={`${text}-${exiting}`}
      style={{
        display: 'inline-block',
        animation: exiting ? 'slideOutUp 0.3s ease-in forwards' : 'slideInUp 0.3s ease-out',
        ...style
      }}
    >
      {text}
    </span>
    <style>{`
      @keyframes slideInUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes slideOutUp {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(-100%); opacity: 0; }
      }
    `}</style>
  </>
);
