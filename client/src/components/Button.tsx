import React from 'react';

interface ButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary' | 'create' | 'join' | 'back' | 'exit' | 'close' | 'disabled';
  style?: React.CSSProperties;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  style,
  fullWidth = false,
  children
}) => {
  const getClassName = () => {
    switch (variant) {
      case 'create': return 'create-game-btn';
      case 'join': return 'join-game-btn';
      case 'back': return 'back-btn';
      case 'close': return 'close-btn';
      case 'exit': return 'exit-game-btn';
      case 'secondary': return 'ready-button';
      case 'disabled': return 'disabled-btn';
      default: return 'start-round-btn';
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={getClassName()}
      style={{ ...style, ...(fullWidth && { width: '100%' }) }}
    >
      {children}
    </button>
  );
};
