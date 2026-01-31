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
            <div className="outer-ring">
              <div className="hue-arrow"></div>
              <div className="hue-marker hue-marker-left"></div>
              <div className="hue-marker hue-marker-right"></div>
              <div className="hue-label">HUE</div>
            </div>
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
          
          <div className="tip-instructions">
            <p>Outer Ring for Color Family</p>
            <p>Inner Circle for Intensity & Brightness</p>
          </div>
        </div>
        
        <button className="tips-dismiss-btn" onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  );
};
