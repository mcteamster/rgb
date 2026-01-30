import React from 'react';

interface ColorWheelTipsProps {
  onDismiss: () => void;
}

export const ColorWheelTips: React.FC<ColorWheelTipsProps> = ({ onDismiss }) => {
  return (
    <div className="color-wheel-tips-overlay">
      <div className="color-wheel-tips-content">
        <div className="tip-visual">
          <div className="exploded-wheel">
            <div className="outer-ring"></div>
            <div className="inner-circle saturation-circle">
              <div className="saturation-arrow"></div>
              <div className="saturation-marker saturation-marker-top"></div>
              <div className="saturation-marker saturation-marker-bottom"></div>
              <div className="saturation-label">SATURATION</div>
            </div>
            <div className="inner-circle lightness-circle">
              <div className="lightness-arrow"></div>
              <div className="lightness-label">LIGHTNESS</div>
            </div>
          </div>
          
          <div className="tip-arrows">
            <div className="arrow arrow-outer">
              <span>Click outer ring for color type</span>
            </div>
            <div className="arrow arrow-inner">
              <span>Click inside for intensity & brightness</span>
            </div>
          </div>
        </div>
        
        <button className="tips-dismiss-btn" onClick={onDismiss}>
          Got it! 🎯
        </button>
      </div>
    </div>
  );
};
