'use client';

import React from "react";
import DualUnitInput from "../components/DualUnitInput";

// Test component to verify DualUnitInput functionality
export default function DualUnitInputTest() {
  const [weight, setWeight] = React.useState(5.0);
  const [volume, setVolume] = React.useState(20.0);
  const [temperature, setTemperature] = React.useState(20.0);

  return (
    <div className="p-8 space-y-6 bg-gray-900 text-white">
      <h1 className="text-2xl font-bold">DualUnitInput Test</h1>

      <div className="space-y-4">
        <label className="block">
          <span className="block text-sm text-gray-300 mb-2">
            Weight (kg ↔ lb)
          </span>
          <DualUnitInput
            value={weight}
            onChange={(newValue) => {
              setWeight(newValue);
            }}
            unitType="weight"
            placeholder="5.0"
          />
          <p className="text-xs text-gray-400 mt-1">
            Current value: {weight} kg
          </p>
        </label>

        <label className="block">
          <span className="block text-sm text-gray-300 mb-2">
            Volume (L ↔ gal)
          </span>
          <DualUnitInput
            value={volume}
            onChange={setVolume}
            unitType="volume"
            placeholder="20.0"
          />
          <p className="text-xs text-gray-400 mt-1">
            Current value: {volume} L
          </p>
        </label>

        <label className="block">
          <span className="block text-sm text-gray-300 mb-2">
            Temperature (°C ↔ °F)
          </span>
          <DualUnitInput
            value={temperature}
            onChange={setTemperature}
            unitType="temperature"
            placeholder="20.0"
          />
          <p className="text-xs text-gray-400 mt-1">
            Current value: {temperature} °C
          </p>
        </label>

        <label className="block">
          <span className="block text-sm text-gray-300 mb-2">
            Gravity (read-only)
          </span>
          <DualUnitInput
            value={1.05}
            onChange={() => {}}
            unitType="gravity"
            placeholder="1.050"
            readOnly={true}
          />
        </label>
      </div>

      <div className="mt-8 p-4 bg-gray-800 rounded">
        <h2 className="text-lg font-semibold mb-2">Test Instructions:</h2>
        <ul className="text-sm space-y-1">
          <li>
            • Click on the unit labels (kg, L, °C) to toggle between units
          </li>
          <li>• Values should convert automatically when you toggle</li>
          <li>• Rounding should occur when switching units</li>
          <li>• All calculations should use the primary unit (kg, L, °C)</li>
          <li>• The read-only input should not allow unit toggling</li>
          <li>• Check the displayed current value updates correctly</li>
        </ul>
      </div>
    </div>
  );
}
