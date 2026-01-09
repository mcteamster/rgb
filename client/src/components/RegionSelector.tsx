import React from 'react';
import { AWS_REGIONS, FLAGS, REGION_LABELS } from '../constants/regions';

interface RegionSelectorProps {
  currentRegion: string;
  onRegionChange: (region: string) => void;
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({ 
  currentRegion, 
  onRegionChange 
}) => {
  const regions = Object.values(AWS_REGIONS).sort();

  return (
    <div className="region-selector">
      <select 
        id="region-select"
        value={currentRegion} 
        onChange={(e) => onRegionChange(e.target.value)}
        className="region-select"
      >
        {regions.map(region => (
          <option key={region} value={region}>
            {FLAGS[region as keyof typeof FLAGS]} {REGION_LABELS[region as keyof typeof REGION_LABELS]}
          </option>
        ))}
      </select>
    </div>
  );
};
