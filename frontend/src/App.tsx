import React, { useState } from 'react';
import { CanvasColorWheel } from './components/CanvasColorWheel';
import { HSVColor, hsvToRgb } from './colorUtils';

const App: React.FC = () => {
  const [selectedColor, setSelectedColor] = useState<HSVColor>({ h: 0, s: 0, v: 0 });
  const [selectedHue, setSelectedHue] = useState(0);
  const [clickPosition, setClickPosition] = useState<{ x: number; y: number } | null>(null);
  
  const size = 400;

  const handleColorClick = (x: number, y: number, hsv: HSVColor) => {
    setSelectedColor(hsv);
    setClickPosition({ x, y });
  };

  const handleHueChange = (hue: number) => {
    setSelectedHue(hue);
    // Update selected color to use new hue but keep existing saturation and brightness
    setSelectedColor(prev => ({ h: hue, s: prev.s, v: prev.v }));
  };

  const [r, g, b] = hsvToRgb(selectedColor.h, selectedColor.s, selectedColor.v);

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif', 
      margin: 0, 
      padding: '20px', 
      background: '#f0f0f0',
      minHeight: '100vh'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: '#3178c6',
          color: 'white',
          padding: '5px 10px',
          borderRadius: '3px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          React + TypeScript
        </div>
        
        <h1>RGB Game - HSV Color Wheel (React)</h1>
        
        <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
          <CanvasColorWheel 
            size={size}
            selectedHue={selectedHue}
            selectedColor={selectedColor}
            clickPosition={clickPosition}
            onColorClick={handleColorClick}
            onHueChange={handleHueChange}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <div style={{
            background: 'white',
            padding: '15px',
            borderRadius: '5px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
          }}>
            <h3>Selected Color</h3>
            <p>HSV: <span>H: {Math.round(selectedColor.h)}, S: {Math.round(selectedColor.s * 100)}%, V: {Math.round(selectedColor.v * 100)}%</span></p>
            <p>RGB: <span>R: {r}, G: {g}, B: {b}</span></p>
            <div style={{
              width: '50px',
              height: '50px',
              border: '2px solid #333',
              borderRadius: '5px',
              display: 'inline-block',
              marginLeft: '10px',
              backgroundColor: `rgb(${r}, ${g}, ${b})`
            }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
