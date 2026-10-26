/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IdeaStep {
  id: string;
  text: string;
  done: boolean;
  date?: string;
  note?: string;
}

export interface IdeaComment {
  id: string;
  text: string;
  image?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  timestamp: string;
}

export interface IdeaFile {
  id?: string;
  name: string;
  url: string;
  type?: string;
}

export interface Idea {
  id: number;
  title: string;
  desc: string;
  links: string[];
  images: string[];
  files?: IdeaFile[];
  status: number; // 0: شروع نشده, 1: در حال انجام, 2: تکمیل شده
  date: string;
  comments?: IdeaComment[];
}

export interface TaskItem {
  text: string;
  done: boolean;
  priority?: 'urgent' | 'important' | 'normal';
  category?: string;
  quantity?: number;
  unit?: string;
}

export interface WeekExtra {
  id: string;
  text: string;
  done: boolean;
}

export interface WeekExtras {
  [dateKey: string]: WeekExtra[];
}

export interface Transaction {
  id: number;
  type: 'expense' | 'income';
  amount: number;
  category: string;
  desc: string;
  dateKey: string;
  jy: number; // Shamsi Year
  jm: number; // Shamsi Month
  jd: number; // Shamsi Day
}

export interface ThemeConfig {
  id: string;
  name: string;
  bg: string;
  overlay: string;
  text: string;
  text2: string;
  text3: string;
  glassBg: string;
  glassBorder: string;
  clockColor: string;
  dateColor: string;
}

export interface LastActivity {
  type: 'note' | 'idea' | 'task' | 'shopping' | 'week' | 'finance' | 'edit_assets';
  text: string;
  ts: number;
}

export interface EditAsset {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'image';
  category: string; // 'میم' | 'گرین اسکرین' | 'ساند افکت' | 'ری‌اکشن' | 'ترانزیشن' | ...
  url: string;
  thumbnailUrl?: string;
  duration?: string;
  tags: string[];
  isBookmarked?: boolean;
  mediaId?: string;
  folderId?: string;
  thumbMediaId?: string;
  noThumb?: boolean;
  libraryId?: string;
  fileName?: string;
  fileSize?: number;
  packageId?: string;
}

export interface EditPackage {
  id: string;
  name: string;
  createdAt: string;
}

export interface EditFolder {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  modelId?: string;
}

export interface Habit {
  id: string;
  title: string;
  type: 'quit' | 'daily';
  createdAt: string; // ISO date string e.g. "2026-08-14"
  completedDates?: string[]; // Array of ISO date strings for daily habits ("انجام دادم")
  avoidedDates?: string[]; // Array of ISO date strings for quit habits ("انجام ندادم")
  category?: string;
  color?: string;
}

export interface AppSettings {
  userName: string;
  calendarType: 'jalali' | 'gregorian';
  clockFormat: '24h' | '12h';
  soundEnabled: boolean;
  privacyMode: boolean; // Hide financial amounts by default
  language?: 'fa' | 'en';
  geminiApiKey: string;
  aiProxyUrl?: string;
  aiProxyEnabled?: boolean;
  aiProvider?: 'gemini' | 'openai';
  openaiBaseUrl?: string;
  openaiApiKey?: string;
  openaiModel?: string;
  pomodoroNotificationEnabled: boolean;
  downloadNotificationEnabled: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

export interface GoalImageTransform {
  xPercent: number; // 0 to 100 (% from left to center of image)
  yPercent: number; // 0 to 100 (% from top to center of image)
  sizePercent: number; // 5 to 60 (% of container width)
  rotationDeg: number; // -180 to 180 degrees
}

export interface GoalImageItem {
  id: string;
  dataUrl: string;
  transform: GoalImageTransform;
  createdAt?: number;
  enabled?: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  pinnedHome?: boolean;
}

export const DEFAULT_GOAL_IMAGE_TRANSFORM: GoalImageTransform = {
  xPercent: 18,
  yPercent: 8,
  sizePercent: 16,
  rotationDeg: 0,
};

export const DEFAULT_SETTINGS: AppSettings = {
  userName: '',
  calendarType: 'jalali',
  clockFormat: '24h',
  soundEnabled: true,
  privacyMode: false,
  language: 'en',
  geminiApiKey: '',
  aiProxyEnabled: false,
  aiProvider: 'gemini',
  openaiBaseUrl: '',
  openaiApiKey: '',
  openaiModel: '',
  pomodoroNotificationEnabled: true,
  downloadNotificationEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00'
};
