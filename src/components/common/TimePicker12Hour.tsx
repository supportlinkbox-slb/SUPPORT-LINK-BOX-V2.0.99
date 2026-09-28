import React from 'react';
import { convert24To12HourString, convert12To24HourString } from '../../utils/timeFormat';

interface TimePicker12HourProps {
  value: string; // e.g. "16:50" or "00:00"
  onChange: (value24: string) => void;
  disabled?: boolean;
}

export const TimePicker12Hour: React.FC<TimePicker12HourProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [hStr, mStr] = (value || '00:00').split(':');
  const h24 = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const handleHourChange = (newHour12: number) => {
    onChange(convert12To24HourString(newHour12, m, period));
  };

  const handleMinuteChange = (newMinute: number) => {
    onChange(convert12To24HourString(hour12, newMinute, period));
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    onChange(convert12To24HourString(hour12, m, newPeriod));
  };

  return (
    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 shadow-inner">
      {/* Hour Select */}
      <select
        value={hour12}
        onChange={(e) => handleHourChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((hr) => (
          <option key={hr} value={hr} className="bg-slate-900 text-white">
            {String(hr).padStart(2, '0')}
          </option>
        ))}
      </select>

      <span className="text-slate-500 font-mono text-xs font-bold">:</span>

      {/* Minute Select */}
      <select
        value={m}
        onChange={(e) => handleMinuteChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none cursor-pointer"
      >
        {Array.from({ length: 60 }, (_, i) => i).map((min) => (
          <option key={min} value={min} className="bg-slate-900 text-white">
            {String(min).padStart(2, '0')}
          </option>
        ))}
      </select>

      {/* AM/PM Toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-800 bg-slate-900 p-0.5 ml-1">
        <button
          type="button"
          onClick={() => handlePeriodChange('AM')}
          disabled={disabled}
          className={`px-2 py-0.5 text-[10px] font-black rounded transition ${
            period === 'AM'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => handlePeriodChange('PM')}
          disabled={disabled}
          className={`px-2 py-0.5 text-[10px] font-black rounded transition ${
            period === 'PM'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          PM
        </button>
      </div>
    </div>
  );
};
