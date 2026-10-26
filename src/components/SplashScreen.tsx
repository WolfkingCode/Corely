/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import CorelyLogo from './icons/CorelyLogo';
import { AppSettings } from '../types';

interface SplashScreenProps {
  key?: string;
  settings?: AppSettings;
}

export default function SplashScreen({ settings }: SplashScreenProps) {
  const isEn = (settings?.language || 'en') === 'en';
  const trimmedName = settings?.userName?.trim();

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-white overflow-hidden select-none"
    >
      {/* Background glowing gradients */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 0.4, scale: 1.2 }}
        transition={{ duration: 1.8, repeat: Infinity, repeatType: 'reverse' }}
        className="absolute w-96 h-96 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 blur-[120px] pointer-events-none"
      />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6 px-6">
        {/* Animated App Icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
          className="relative"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40 border border-white/20">
            <CorelyLogo className="w-10 h-10 text-white drop-shadow-md" />
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
            className="absolute -top-2 -right-2 p-1.5 rounded-xl bg-amber-400 text-slate-950 shadow-lg"
          >
            <Sparkles className="w-4 h-4 fill-amber-400" />
          </motion.div>
        </motion.div>

        {/* Text Title & Subtitle */}
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center justify-center"
          >
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border border-white/10 bg-white/5">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-purple-200">
                Corely
              </span>
              <span className="text-[9px] sm:text-[10px] font-black tracking-wide px-1.5 py-0.5 rounded-md bg-violet-500/20 text-violet-300 border border-violet-400/30 leading-none">
                BETA
              </span>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="text-xs sm:text-sm text-slate-400 font-medium"
          >
            {trimmedName 
              ? (isEn ? `Welcome, ${trimmedName} ✨` : `خوش آمدید، ${trimmedName} عزیز ✨`)
              : (isEn ? 'Welcome ✨' : 'خوش آمدید ✨')}
          </motion.p>
        </div>

        {/* Loading Progress Indicator */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: '140px' }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="h-1 bg-slate-800 rounded-full overflow-hidden border border-white/10 mt-4"
        >
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.7 }}
            className="h-full bg-gradient-to-r from-purple-500 via-indigo-400 to-blue-400 rounded-full"
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
