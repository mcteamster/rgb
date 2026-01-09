import React from 'react';
import { HSLColor } from '../types/game';

interface ColorBoxProps {
  color: HSLColor;
  width?: string;
  height?: string;
  fontSize?: string;
  onClick?: () => void;
  className?: string;
  label?: string;
}

export const ColorBox: React.FC<ColorBoxProps> = ({
  color,
  width = '200px',
  height = '60px',
  fontSize = '12px',
  onClick,
  className = '',
  label
}) => {
  return (
    <div
      className={`color-box ${className}`}
      onClick={onClick}
      style={{
        backgroundColor: `hsl(${color.h}, ${color.s}%, ${color.l}%)`,
        width,
        height,
        borderRadius: '12px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {label && (
        <div style={{ 
          fontSize: '14px', 
          fontWeight: 'bold',
          color: color.l > 50 ? 'black' : 'white',
          marginBottom: '4px'
        }}>
          {label}
        </div>
      )}
      <div
        className="color-values-overlay"
        style={{
          color: color.l > 50 ? 'black' : 'white',
          fontSize,
          display: 'flex',
          gap: '12px'
        }}
      >
        <span>H: {Math.round(color.h)}°</span>
        <span>S: {Math.round(color.s)}%</span>
        <span>L: {Math.round(color.l)}%</span>
      </div>
    </div>
  );
};
