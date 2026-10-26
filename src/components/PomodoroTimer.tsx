/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Flame, Coffee, Trophy, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { notify } from '../lib/notifications';
import { AppSettings } from '../types';

export type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

interface PomodoroTimerProps {
  isEn?: boolean;
  settings?: AppSettings;
}

function checkPomodoroNotificationEnabled(settings?: AppSettings): boolean {
  if (settings && typeof settings.pomodoroNotificationEnabled === 'boolean') {
    return settings.pomodoroNotificationEnabled;
  }
  try {
    const raw = localStorage.getItem('v3_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.pomodoroNotificationEnabled === 'boolean') {
        return parsed.pomodoroNotificationEnabled;
      }
    }
  } catch {}
  return true;
}

const DURATIONS: Record<PomodoroMode, number> = {
  work: 25 * 60,       // 25 minutes
  shortBreak: 5 * 60,  // 5 minutes
  longBreak: 15 * 60,  // 15 minutes
};

// Play sound tone via Web Audio API
const playTone = (type: 'finish' | 'click') => {
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'finish') {
      // Pleasant chime sound (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.5);
      });
    } else {
      // Subtle click sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    }
  } catch (e) {
    console.error("Audio playback error:", e);
  }
};

const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error(`Failed to save ${key} to localStorage:`, e);
  }
};

export default function PomodoroTimer({ isEn = false, settings }: PomodoroTimerProps) {
  const [mode, setMode] = useState<PomodoroMode>(() => {
    try {
      return (localStorage.getItem('pomo_mode') as PomodoroMode) || 'work';
    } catch {
      return 'work';
    }
  });
  
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pomo_time_left');
      return saved ? parseInt(saved, 10) : DURATIONS.work;
    } catch {
      return DURATIONS.work;
    }
  });

  const [isRunning, setIsRunning] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pomo_is_running') === 'true';
    } catch {
      return false;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('pomo_sound') !== 'false';
    } catch {
      return true;
    }
  });

  const [completedSessions, setCompletedSessions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('pomo_completed_count');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastNotificationTimeRef = useRef<number>(0);
  const timeLeftRef = useRef<number>(timeLeft);
  timeLeftRef.current = timeLeft;
  const isFirstMountRunningRef = useRef<boolean>(true);
  const isFirstMountModeRef = useRef<boolean>(true);

  const sendIntervalNotification = (finishedMode: PomodoroMode) => {
    const now = Date.now();
    if (now - lastNotificationTimeRef.current < 4000) return;
    lastNotificationTimeRef.current = now;

    if (!checkPomodoroNotificationEnabled(settings)) return;

    if (finishedMode === 'work') {
      notify({
        title: isEn ? 'Focus Session Complete' : 'پایان تمرکز',
        body: isEn ? 'Time for a break.' : 'وقت استراحت است'
      });
    } else {
      notify({
        title: isEn ? 'Break Finished' : 'پایان استراحت',
        body: isEn ? 'Back to work.' : 'برگردیم سر کار'
      });
    }
  };

  // Sync mode only when changed
  useEffect(() => {
    safeSetItem('pomo_mode', mode);
  }, [mode]);

  // Sync soundEnabled only when changed
  useEffect(() => {
    safeSetItem('pomo_sound', soundEnabled.toString());
  }, [soundEnabled]);

  // Sync completedSessions only when changed
  useEffect(() => {
    safeSetItem('pomo_completed_count', completedSessions.toString());
  }, [completedSessions]);

  // Sync isRunning only when changed
  useEffect(() => {
    safeSetItem('pomo_is_running', isRunning.toString());
  }, [isRunning]);

  // Sync timeLeft during running (every 5 seconds)
  useEffect(() => {
    if (isRunning && timeLeft % 5 === 0) {
      safeSetItem('pomo_time_left', timeLeft.toString());
    }
  }, [timeLeft, isRunning]);

  // Immediately sync timeLeft on timer start / stop
  useEffect(() => {
    if (isFirstMountRunningRef.current) {
      isFirstMountRunningRef.current = false;
      return;
    }
    safeSetItem('pomo_time_left', timeLeftRef.current.toString());
  }, [isRunning]);

  // Immediately sync timeLeft on mode change
  useEffect(() => {
    if (isFirstMountModeRef.current) {
      isFirstMountModeRef.current = false;
      return;
    }
    safeSetItem('pomo_time_left', DURATIONS[mode].toString());
  }, [mode]);

  // Immediately sync timeLeft on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      safeSetItem('pomo_time_left', timeLeftRef.current.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      safeSetItem('pomo_time_left', timeLeftRef.current.toString());
    };
  }, []);

  // Handle timer ticks
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer Finished!
            if (soundEnabled) playTone('finish');
            sendIntervalNotification(mode);

            if (mode === 'work') {
              const newCount = completedSessions + 1;
              setCompletedSessions(newCount);
              // Switch to break
              const nextMode = newCount % 4 === 0 ? 'longBreak' : 'shortBreak';
              setMode(nextMode);
              return DURATIONS[nextMode];
            } else {
              // Switch back to work
              setMode('work');
              return DURATIONS.work;
            }
          }
          return prev - 1;
        });
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, completedSessions, soundEnabled, isEn, settings]);

  const switchMode = (newMode: PomodoroMode) => {
    if (soundEnabled) playTone('click');
    setIsRunning(false);
    setMode(newMode);
    setTimeLeft(DURATIONS[newMode]);
    safeSetItem('pomo_time_left', DURATIONS[newMode].toString());
  };

  const toggleTimer = () => {
    if (soundEnabled) playTone('click');
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    if (soundEnabled) playTone('click');
    setIsRunning(false);
    const duration = DURATIONS[mode];
    setTimeLeft(duration);
    safeSetItem('pomo_time_left', duration.toString());
  };

  const skipTimer = () => {
    if (soundEnabled) playTone('click');
    setIsRunning(false);
    if (mode === 'work') {
      setMode('shortBreak');
      setTimeLeft(DURATIONS.shortBreak);
      safeSetItem('pomo_time_left', DURATIONS.shortBreak.toString());
    } else {
      setMode('work');
      setTimeLeft(DURATIONS.work);
      safeSetItem('pomo_time_left', DURATIONS.work.toString());
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  const totalDuration = DURATIONS[mode];
  const progressPercent = Math.min(100, Math.max(0, ((totalDuration - timeLeft) / totalDuration) * 100));

  // Theme colors based on mode
  const modeColors = {
    work: {
      gradient: 'from-rose-500 via-orange-500 to-amber-500',
      bgGlow: 'from-rose-500/10 via-orange-500/5 to-transparent',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      ringColor: 'stroke-rose-500',
      buttonBg: 'bg-gradient-to-r from-rose-500 to-orange-500 hover:from-rose-600 hover:to-orange-600',
    },
    shortBreak: {
      gradient: 'from-emerald-500 via-teal-500 to-cyan-500',
      bgGlow: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      ringColor: 'stroke-emerald-500',
      buttonBg: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600',
    },
    longBreak: {
      gradient: 'from-indigo-500 via-purple-500 to-pink-500',
      bgGlow: 'from-indigo-500/10 via-purple-500/5 to-transparent',
      border: 'border-indigo-500/30',
      text: 'text-indigo-400',
      badgeBg: 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400',
      ringColor: 'stroke-indigo-500',
      buttonBg: 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600',
    }
  }[mode];

  return (
    <div className={`relative overflow-hidden rounded-3xl border ${modeColors.border} bg-[var(--card-bg)] backdrop-blur-2xl p-5 sm:p-5.5 shadow-lg transition-all duration-300 flex flex-col justify-between h-full space-y-4`}>
      {/* Background Glow */}
      <div className={`absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl ${modeColors.bgGlow} blur-3xl pointer-events-none -z-10`} />

      <div className="space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--border)] pb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${modeColors.gradient} text-white flex items-center justify-center shadow-md shrink-0`}>
              {mode === 'work' ? <Flame className="w-5 h-5" /> : <Coffee className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-[var(--text)] flex items-center gap-2 truncate">
                {isEn ? 'Focus Timer (Pomodoro)' : 'تایمر تمرکز (پومودورو)'}
              </h3>
              <p className="text-[11px] text-[var(--text3)] line-clamp-1">
                {isEn ? '25m focus + 5m break for productivity' : '۲۵ دقیقه کار عمیق + ۵ دقیقه استراحت'}
              </p>
            </div>
          </div>

          {/* Action Controls & Sound Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Completed counter badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--sidebar-hover)] border border-[var(--border)] text-xs font-bold text-[var(--text2)]">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{completedSessions}</span>
              <span className="text-[10px] text-[var(--text3)]">{isEn ? 'Sessions' : 'جلسه'}</span>
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 sm:p-2 rounded-xl bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title={soundEnabled ? (isEn ? "Mute audio" : "بی‌صدا کردن") : (isEn ? "Enable audio" : "فعال‌سازی صدا")}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 rounded-2xl bg-[var(--sidebar-hover)] border border-[var(--border)]">
          <button
            onClick={() => switchMode('work')}
            className={`py-1.5 sm:py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
              mode === 'work'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-xs'
                : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'
            }`}
          >
            <Flame className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Work (25m)' : 'تمرکز (۲۵ د)'}</span>
          </button>

          <button
            onClick={() => switchMode('shortBreak')}
            className={`py-1.5 sm:py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
              mode === 'shortBreak'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs'
                : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'
            }`}
          >
            <Coffee className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Break (5m)' : 'استراحت (۵ د)'}</span>
          </button>

          <button
            onClick={() => switchMode('longBreak')}
            className={`py-1.5 sm:py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
              mode === 'longBreak'
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-xs'
                : 'text-[var(--text3)] hover:text-[var(--text)] hover:bg-white/5'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{isEn ? 'Long Break' : 'استراحت بلند'}</span>
          </button>
        </div>
      </div>

      {/* Main Countdown Display & Controls Container */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 sm:p-4 rounded-2xl bg-[var(--sidebar-hover)]/60 border border-[var(--border)] mt-auto">
        
        {/* Radial Timer SVG & Digits */}
        <div className="relative w-32 h-32 sm:w-34 sm:h-34 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background Ring */}
            <circle
              cx="50"
              cy="50"
              r="42"
              className="stroke-[var(--border)] fill-none"
              strokeWidth="6"
            />
            {/* Animated Progress Ring */}
            <circle
              cx="50"
              cy="50"
              r="42"
              className={`${modeColors.ringColor} fill-none transition-all duration-500 ease-linear`}
              strokeWidth="6"
              strokeDasharray={263.89} // 2 * PI * 42
              strokeDashoffset={263.89 - (263.89 * progressPercent) / 100}
              strokeLinecap="round"
            />
          </svg>

          {/* Time text centered */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
            <span className="text-2xl font-black text-[var(--text)] tracking-wider font-mono dir-ltr">
              {formattedTime}
            </span>
            <span className={`text-[10px] font-extrabold uppercase tracking-widest mt-0.5 ${modeColors.text}`}>
              {mode === 'work' ? (isEn ? 'FOCUS' : 'تمرکز') : (isEn ? 'BREAK' : 'استراحت')}
            </span>
          </div>
        </div>

        {/* Controls & Quick Info */}
        <div className="flex-1 flex flex-col items-center sm:items-start justify-center gap-2.5 w-full">
          <div className="text-center sm:text-right">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border mb-1 ${modeColors.badgeBg}`}>
              {mode === 'work' ? <Flame className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
              <span>
                {mode === 'work' 
                  ? (isEn ? 'Deep Work Session' : 'زمان کار و یادگیری عمیق') 
                  : (isEn ? 'Rest & Recharge' : 'زمان استراحت و بازسازی')}
              </span>
            </div>
            <p className="text-[11.5px] text-[var(--text2)] leading-relaxed line-clamp-2">
              {mode === 'work'
                ? (isEn ? 'Stay focused on one task without distraction.' : 'بر روی یک هدف تمرکز کنید و پیام‌ها را کنار بگذارید.')
                : (isEn ? 'Take a short break, stretch, or drink water.' : 'کمی حرکت کنید، آب بنوشید و استراحت کنید.')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-1 w-full sm:w-auto">
            <button
              onClick={toggleTimer}
              className={`flex-1 sm:flex-initial px-5 py-2 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${modeColors.buttonBg} active:scale-95`}
            >
              {isRunning ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>{isEn ? 'Pause' : 'توقف'}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isEn ? 'Start' : 'شروع'}</span>
                </>
              )}
            </button>

            <button
              onClick={resetTimer}
              className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] hover:border-slate-400/40 transition-colors cursor-pointer"
              title={isEn ? "Reset timer" : "بازنشانی تایمر"}
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={skipTimer}
              className="p-2 rounded-xl bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] hover:border-slate-400/40 transition-colors cursor-pointer"
              title={isEn ? "Skip session" : "رد کردن این مرحله"}
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
