'use client';

/**
 * @fileoverview Timer components with linear and circular variants.
 * @module components/ui/Timer
 *
 * @description
 * Provides countdown timer components with progress indicators.
 * Includes both linear (Timer) and circular (CircularTimer) variants.
 *
 * @pattern Observer Pattern - Reacts to time changes via useEffect
 */

import { useEffect, useState } from 'react';
import { cn, formatTime } from '@/lib/utils';

/**
 * Timer configuration defaults.
 * @internal
 */
const TIMER_DEFAULTS = {
  /** Seconds threshold for warning state (red, pulsing) */
  WARNING_THRESHOLD_SECONDS: 10,
  /** Interval between timer ticks in milliseconds (1 second) */
  TICK_INTERVAL_MS: 1000,
} as const;

export interface TimerProps {
  initialSeconds: number;
  onComplete?: () => void;
  className?: string;
  showProgress?: boolean;
}

export function Timer({
  initialSeconds,
  onComplete,
  className,
  showProgress = true
}: TimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    setSeconds(initialSeconds);
    setIsWarning(false);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds <= 0) {
      onComplete?.();
      return;
    }

    if (seconds <= TIMER_DEFAULTS.WARNING_THRESHOLD_SECONDS) {
      setIsWarning(true);
    }

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, TIMER_DEFAULTS.TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [seconds, onComplete]);

  const progress = (seconds / initialSeconds) * 100;

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      {/* Timer display */}
      <div
        className={cn(
          'text-2xl font-mono font-bold',
          isWarning ? 'text-red-500 animate-pulse' : 'text-white'
        )}
      >
        {formatTime(seconds)}
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-1000 ease-linear rounded-full',
              isWarning ? 'bg-red-500' : 'bg-blue-500'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export interface CircularTimerProps {
  initialSeconds: number;
  onComplete?: () => void;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** When true, timer displays but doesn't count down */
  paused?: boolean;
}

export function CircularTimer({
  initialSeconds,
  onComplete,
  size = 80,
  strokeWidth = 4,
  className,
  paused = false
}: CircularTimerProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    setSeconds(initialSeconds);
    setIsWarning(false);
  }, [initialSeconds]);

  useEffect(() => {
    // Don't countdown when paused
    if (paused) return;

    if (seconds <= 0) {
      onComplete?.();
      return;
    }

    if (seconds <= TIMER_DEFAULTS.WARNING_THRESHOLD_SECONDS) {
      setIsWarning(true);
    }

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, TIMER_DEFAULTS.TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [seconds, onComplete, paused]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (seconds / initialSeconds) * 100;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-all duration-1000 ease-linear',
            isWarning ? 'text-red-500' : 'text-blue-500'
          )}
        />
      </svg>
      {/* Timer text */}
      <div
        className={cn(
          'absolute text-lg font-mono font-bold',
          isWarning ? 'text-red-500' : 'text-white'
        )}
      >
        {formatTime(seconds)}
      </div>
    </div>
  );
}
