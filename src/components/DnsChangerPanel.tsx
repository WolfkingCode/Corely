/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Copy, 
  Check, 
  Star, 
  ShieldCheck, 
  Globe, 
  Lock, 
  Loader2, 
  Layers, 
  AlertCircle,
  Power,
  Plus,
  Trash2,
  X,
  SlidersHorizontal
} from 'lucide-react';
import { loadFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { isDesktopApp } from '../lib/notifications';
import { AppSettings } from '../types';
import Select from './Select';

export type DnsCategory = 'antifilter' | 'international' | 'secure';

interface DnsResponse {
  success: boolean;
  error?: string;
}

export interface DnsServer {
  id: string;
  name: string;
  category: DnsCategory;
  primary: string;
  secondary: string;
  descriptionFa: string;
  descriptionEn: string;
  isCustom?: boolean;
}

export const DNS_SERVERS: DnsServer[] = [
  // Anti-filter & Unsanctioned category
  {
    id: 'shecan',
    name: 'شکن (Shecan)',
    category: 'antifilter',
    primary: '178.22.122.100',
    secondary: '185.51.200.2',
    descriptionFa: 'سامانه تحریم‌شکن برای دسترسی آسان برنامه‌نویسان و کاربران به سرویس‌های بین‌المللی',
    descriptionEn: 'Sanctions bypass DNS for accessing restricted developer tools and websites'
  },
  {
    id: 'electro',
    name: 'الکترو (Electro)',
    category: 'antifilter',
    primary: '78.157.42.100',
    secondary: '78.157.42.101',
    descriptionFa: 'سرویس رفع تحریم با پایداری مناسب برای بازی‌های آنلاین و پلتفرم‌های کاربردی',
    descriptionEn: 'Anti-sanctions and gaming DNS server with stable latency'
  },
  {
    id: '403online',
    name: '۴۰۳ آنلاین (403.online)',
    category: 'antifilter',
    primary: '10.202.10.202',
    secondary: '10.202.10.102',
    descriptionFa: 'سرویس برطرف‌کننده خطای تحریم ۴۰۳ برای وبسایت‌ها و مخازن نرم‌افزاری',
    descriptionEn: 'Resolves HTTP 403 sanctions errors for web services and dev repositories'
  },
  {
    id: 'radargame',
    name: 'رادار گیم (Radar Game)',
    category: 'antifilter',
    primary: '10.202.10.10',
    secondary: '10.202.10.11',
    descriptionFa: 'بهینه‌سازی شده برای گیمرها به منظور کاهش پینگ و دور زدن تحریم‌های سرورهای بازی',
    descriptionEn: 'Optimized for online games to reduce ping and bypass regional IP restrictions'
  },

  // International category
  {
    id: 'google',
    name: 'گوگل (Google Public DNS)',
    category: 'international',
    primary: '8.8.8.8',
    secondary: '8.8.4.4',
    descriptionFa: 'سریع‌ترین و پایدارترین سرور DNS جهانی با زیرساخت عظیم گوگل',
    descriptionEn: 'High-performance, global DNS resolution powered by Google infrastructure'
  },
  {
    id: 'cloudflare',
    name: 'کلودفلر (Cloudflare 1.1.1.1)',
    category: 'international',
    primary: '1.1.1.1',
    secondary: '1.0.0.1',
    descriptionFa: 'معروف به سریع‌ترین DNS جهان با اولویت حریم خصوصی و عدم ذخیره گزارش ترافیک',
    descriptionEn: 'Privacy-first DNS that never sells user data or logs browsing queries'
  },
  {
    id: 'quad9',
    name: 'Quad9',
    category: 'international',
    primary: '9.9.9.9',
    secondary: '149.112.112.112',
    descriptionFa: 'مسدودکننده بدافزارها و فیشینگ با تمرکز ویژه بر حریم خصوصی و امنیت سایبری',
    descriptionEn: 'Blocks malicious domains, phishing, and malware with Swiss privacy standards'
  },

  // Secure & Family category
  {
    id: 'cloudflare_family',
    name: 'Cloudflare Family 1.1.1.3',
    category: 'secure',
    primary: '1.1.1.3',
    secondary: '1.0.0.3',
    descriptionFa: 'مسدودسازی خودکار بدافزارها و محتوای غیراخلاقی برای محافظت از خانواده',
    descriptionEn: 'Built-in protection blocking malware and adult content for safe family browsing'
  },
  {
    id: 'opendns_family',
    name: 'OpenDNS FamilyShield',
    category: 'secure',
    primary: '208.67.222.123',
    secondary: '208.67.220.123',
    descriptionFa: 'فیلترینگ خودکار محتوای نامناسب و وبسایت‌های خطرناک بدون نیاز به تنظیمات پیچیده',
    descriptionEn: 'Pre-configured parental control blocking adult content and malicious threats'
  }
];

interface PingResult {
  latency?: number; // ms
  status: 'testing' | 'success' | 'error';
}

interface DnsChangerPanelProps {
  settings?: AppSettings;
}

// Simple IPv4 validation helper
function isValidIPv4(ip: string): boolean {
  const trimmed = ip.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && (part === '0' || !part.startsWith('0'));
  });
}

export default function DnsChangerPanel({ settings }: DnsChangerPanelProps) {
  const isEn = settings?.language === 'en';

  // 1. Storage & State for Custom DNS
  const [customDnsList, setCustomDnsList] = useState<DnsServer[]>(() => {
    return loadFromLocalStorage<DnsServer[]>('v3_dns_custom', []);
  });

  // 2. Active Category & Pinned IDs
  const [activeCategory, setActiveCategory] = useState<'all' | DnsCategory>('all');
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    return loadFromLocalStorage<string[]>('v3_dns_pinned', []);
  });

  // 3. Selection & Radar Game-style Connection State
  const [selectedDnsId, setSelectedDnsId] = useState<string | null>(() => {
    return loadFromLocalStorage<string | null>('v3_dns_selected', null);
  });
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 4. Custom DNS Form State
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPrimary, setFormPrimary] = useState('');
  const [formSecondary, setFormSecondary] = useState('');
  const [formCategory, setFormCategory] = useState<DnsCategory>('international');
  const [formErrors, setFormErrors] = useState<{ name?: string; primary?: string; secondary?: string }>({});

  // 5. Ping & Copy States
  const [pingResults, setPingResults] = useState<Record<string, PingResult>>({});
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Combined DNS Servers List
  const allServers = useMemo(() => {
    return [...DNS_SERVERS, ...customDnsList];
  }, [customDnsList]);

  // Find currently selected DNS item
  const selectedDns = useMemo(() => {
    return allServers.find((s) => s.id === selectedDnsId) || null;
  }, [allServers, selectedDnsId]);

  // Synchronize pinned IDs
  const handleTogglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      saveToLocalStorage('v3_dns_pinned', next);
      return next;
    });
  };

  // Select DNS Server for connection
  const handleSelectDns = async (id: string) => {
    setSelectedDnsId(id);
    saveToLocalStorage('v3_dns_selected', id);
    if (connectionStatus === 'connected') {
      if (isDesktopApp()) {
        await window.corelyDesktop?.setDns?.({ reset: true });
      }
      setConnectionStatus('disconnected');
    }
    setIsPickerOpen(false);
  };

  // Delete Custom DNS
  const handleDeleteCustomDns = async (id: string) => {
    const updated = customDnsList.filter((s) => s.id !== id);
    setCustomDnsList(updated);
    saveToLocalStorage('v3_dns_custom', updated);
    if (selectedDnsId === id) {
      setSelectedDnsId(null);
      saveToLocalStorage('v3_dns_selected', null);
      if (isDesktopApp() && connectionStatus === 'connected') {
        await window.corelyDesktop?.setDns?.({ reset: true });
      }
      setConnectionStatus('disconnected');
    }
  };

  // Save new Custom DNS from form
  const handleSaveCustomDns = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { name?: string; primary?: string; secondary?: string } = {};

    if (!formName.trim()) {
      errors.name = isEn ? 'Name is required' : 'وارد کردن نام الزامی است';
    }

    if (!formPrimary.trim()) {
      errors.primary = isEn ? 'Primary IP is required' : 'وارد کردن آی‌پی اول الزامی است';
    } else if (!isValidIPv4(formPrimary)) {
      errors.primary = isEn ? 'Invalid IPv4 address (e.g. 1.1.1.1)' : 'آدرس IPv4 نامعتبر است (مثلاً 1.1.1.1)';
    }

    if (formSecondary.trim() && !isValidIPv4(formSecondary)) {
      errors.secondary = isEn ? 'Invalid IPv4 address' : 'آدرس IPv4 نامعتبر است';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const newCustomServer: DnsServer = {
      id: `custom-${Date.now()}`,
      name: formName.trim(),
      category: formCategory,
      primary: formPrimary.trim(),
      secondary: formSecondary.trim() || formPrimary.trim(),
      descriptionFa: 'سرور DNS سفارشی افزوده شده توسط کاربر',
      descriptionEn: 'Custom user-defined DNS server',
      isCustom: true
    };

    const updated = [...customDnsList, newCustomServer];
    setCustomDnsList(updated);
    saveToLocalStorage('v3_dns_custom', updated);

    // Reset form
    setFormName('');
    setFormPrimary('');
    setFormSecondary('');
    setFormCategory('international');
    setFormErrors({});
    setIsAddFormOpen(false);
  };

  // Power Button Connection Toggle (Radar Game style simulation in web / Real DNS in Desktop)
  const handleToggleConnect = async () => {
    if (connectionStatus === 'connecting') return;

    if (!selectedDnsId || !selectedDns) {
      setIsPickerOpen(true);
      return;
    }

    setActionError(null);

    if (connectionStatus === 'disconnected') {
      setConnectionStatus('connecting');

      if (isDesktopApp()) {
        try {
          const res: DnsResponse = (await window.corelyDesktop?.setDns?.({
            primary: selectedDns.primary,
            secondary: selectedDns.secondary
          })) || { success: false, error: 'no_response' };

          if (res.success) {
            setConnectionStatus('connected');
          } else {
            setConnectionStatus('disconnected');
            if (res.error === 'permission_denied') {
              setActionError(
                isEn
                  ? 'Administrator permission was not granted in the Windows (UAC) prompt, so DNS was not changed.'
                  : 'دسترسی مدیر در پنجرهی تایید ویندوز (UAC) داده نشد، برای همین DNS تغییر نکرد.'
              );
            } else {
              setActionError(
                isEn
                  ? res.error || 'Failed to set DNS'
                  : res.error || 'خطا در اعمال تنظیمات DNS'
              );
            }
          }
        } catch {
          setConnectionStatus('disconnected');
          setActionError(
            isEn ? 'Failed to communicate with desktop service' : 'خطا در ارتباط با سرویس دسکتاپ'
          );
        }
      } else {
        // Web simulation
        setTimeout(() => {
          setConnectionStatus('connected');
        }, 1200);
      }
    } else if (connectionStatus === 'connected') {
      if (isDesktopApp()) {
        setConnectionStatus('connecting');
        try {
          const res: DnsResponse = (await window.corelyDesktop?.setDns?.({
            reset: true
          })) || { success: false, error: 'no_response' };

          setConnectionStatus('disconnected');
          if (!res.success) {
            if (res.error === 'permission_denied') {
              setActionError(
                isEn
                  ? 'Administrator permission was not granted in the Windows (UAC) prompt, so DNS was not reset.'
                  : 'دسترسی مدیر در پنجرهی تایید ویندوز (UAC) داده نشد، برای همین DNS به حالت قبل برنگشت.'
              );
            } else {
              setActionError(
                isEn ? res.error || 'Failed to reset DNS' : res.error || 'خطا در بازگرداندن DNS'
              );
            }
          }
        } catch {
          setConnectionStatus('disconnected');
          setActionError(
            isEn ? 'Failed to communicate with desktop service' : 'خطا در ارتباط با سرویس دسکتاپ'
          );
        }
      } else {
        setConnectionStatus('disconnected');
      }
    }
  };

  // Clipboard copy handler with feedback
  const handleCopy = async (text: string, key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  // Ping a single DNS server via best-effort HTTPS fetch
  const pingDnsServer = async (dns: DnsServer): Promise<PingResult> => {
    const start = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      await fetch(`https://${dns.primary}`, {
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      const latency = Math.round(performance.now() - start);
      return { latency, status: 'success' };
    } catch {
      clearTimeout(timeoutId);
      // Best effort fallback try secondary IP
      const startSec = performance.now();
      const controllerSec = new AbortController();
      const timeoutSec = setTimeout(() => controllerSec.abort(), 2500);
      try {
        await fetch(`https://${dns.secondary}`, {
          mode: 'no-cors',
          signal: controllerSec.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutSec);
        const latency = Math.round(performance.now() - startSec);
        return { latency, status: 'success' };
      } catch {
        clearTimeout(timeoutSec);
        return { status: 'error' };
      }
    }
  };

  // Test speed for all DNS servers concurrently
  const handleTestAllSpeed = async () => {
    if (isTestingAll) return;
    setIsTestingAll(true);

    const initialTestStates: Record<string, PingResult> = {};
    allServers.forEach((d) => {
      initialTestStates[d.id] = { status: 'testing' };
    });
    setPingResults((prev) => ({ ...prev, ...initialTestStates }));

    const promises = allServers.map(async (dns) => {
      const result = await pingDnsServer(dns);
      setPingResults((prev) => ({ ...prev, [dns.id]: result }));
      return { id: dns.id, result };
    });

    await Promise.allSettled(promises);
    setIsTestingAll(false);
  };

  // Filtered and sorted list: pinned first, then by latency if tested, or default order
  const displayList = useMemo(() => {
    let filtered = allServers.filter((d) => {
      if (activeCategory === 'all') return true;
      return d.category === activeCategory;
    });

    return filtered.sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      // If ping results exist for both, sort by fastest
      const aPing = pingResults[a.id];
      const bPing = pingResults[b.id];
      if (aPing?.status === 'success' && bPing?.status === 'success') {
        return (aPing.latency ?? 9999) - (bPing.latency ?? 9999);
      }
      if (aPing?.status === 'success') return -1;
      if (bPing?.status === 'success') return 1;

      return 0;
    });
  }, [allServers, activeCategory, pinnedIds, pingResults]);

  return (
    <div className="space-y-6 pb-10" id="dns-changer-panel">
      {/* ========================================================================= */}
      {/* 1. HERO SECTION: Radar Game-Style Interactive Power Button               */}
      {/* ========================================================================= */}
      <div className="relative rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] p-6 md:p-8 shadow-xs flex flex-col items-center justify-center text-center overflow-hidden">
        {/* Connection Status Label */}
        <div className="mb-5 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                  : connectionStatus === 'connecting'
                  ? 'bg-sky-400 animate-ping'
                  : 'bg-[var(--text3)] opacity-60'
              }`}
            />
            <span
              className={`text-sm md:text-base font-bold tracking-tight transition-colors ${
                connectionStatus === 'connected'
                  ? 'text-emerald-400'
                  : connectionStatus === 'connecting'
                  ? 'text-sky-400'
                  : 'text-[var(--text3)]'
              }`}
            >
              {connectionStatus === 'connected'
                ? isEn
                  ? `Connected to ${selectedDns?.name || 'DNS'}`
                  : `متصل به ${selectedDns?.name || 'DNS'}`
                : connectionStatus === 'connecting'
                ? isEn
                  ? 'Connecting...'
                  : 'در حال اتصال...'
                : isEn
                ? 'Disconnected'
                : 'متصل نیستید'}
            </span>
          </div>

          {selectedDns && connectionStatus === 'connected' && (
            <span className="font-mono text-xs text-[var(--text2)] opacity-80">
              {selectedDns.primary}
            </span>
          )}
        </div>

        {/* Circular Big Power Button (140x140) */}
        <div className="relative flex items-center justify-center my-2">
          {/* Outer glow ring when connected */}
          {connectionStatus === 'connected' && (
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl scale-125 animate-pulse pointer-events-none" />
          )}

          <button
            type="button"
            onClick={handleToggleConnect}
            disabled={connectionStatus === 'connecting'}
            title={
              !selectedDnsId
                ? isEn ? 'Choose DNS first' : 'ابتدا یک DNS انتخاب کنید'
                : connectionStatus === 'connected'
                ? isEn ? 'Disconnect' : 'قطع اتصال'
                : isEn ? 'Connect' : 'اتصال'
            }
            className={`relative w-32 h-32 md:w-36 md:h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-lg cursor-pointer ${
              connectionStatus === 'connected'
                ? 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.45)] ring-4 ring-emerald-500/20 hover:scale-103'
                : connectionStatus === 'connecting'
                ? 'bg-sky-500/20 text-sky-400 border-2 border-sky-500/50 shadow-[0_0_30px_rgba(56,189,248,0.35)] animate-pulse cursor-wait'
                : 'bg-[var(--input-bg)]/80 text-[var(--text3)] border-2 border-[var(--border)] hover:border-[var(--text3)]/50 hover:text-[var(--text2)] hover:scale-103'
            }`}
          >
            <Power className="w-12 h-12 md:w-14 md:h-14 transition-transform active:scale-95" />
          </button>
        </div>

        {/* Secondary Choose DNS Button */}
        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition cursor-pointer shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            <span>
              {selectedDns
                ? selectedDns.name
                : isEn
                ? 'Choose DNS'
                : 'انتخاب DNS'}
            </span>
          </button>
        </div>

        {/* Action Error / Status Banner */}
        {actionError && (
          <div
            className={`mt-4 px-4 py-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 max-w-md w-full ${
              actionError.includes('مدیر') || actionError.includes('Administrator')
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2 text-start flex-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="p-1 rounded-lg shrink-0 cursor-pointer opacity-75 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Disclaimer note / Desktop status note */}
        <p className="mt-4 text-[11px] text-[var(--text3)] opacity-75 max-w-md">
          {isDesktopApp()
            ? isEn
              ? 'Changes will be applied to your system network settings.'
              : 'تغییرات روی تنظیمات شبکه‌ی سیستم شما اعمال می‌شود.'
            : isEn
            ? 'This is a visual preview only and does not change your system DNS yet; real functionality will be enabled in the Desktop edition.'
            : 'این وضعیت نمایشی است و DNS واقعی سیستم را تغییر نمی‌دهد؛ در نسخه دسکتاپ فعال خواهد شد.'}
        </p>
      </div>

      {/* ========================================================================= */}
      {/* 2. CATEGORY TABS & ACTION BUTTONS                                         */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-xs'
                : 'bg-[var(--card-bg)] text-[var(--text3)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--sidebar-hover)]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isEn ? 'All' : 'همه'}</span>
            <span className="text-[10px] opacity-70">({allServers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('antifilter')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              activeCategory === 'antifilter'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40 shadow-xs'
                : 'bg-[var(--card-bg)] text-[var(--text3)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--sidebar-hover)]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>{isEn ? 'Anti-filter & Sanctions' : 'ضدفیلتر و تحریم‌شکن'}</span>
            <span className="text-[10px] opacity-70">
              ({allServers.filter((d) => d.category === 'antifilter').length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('international')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              activeCategory === 'international'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40 shadow-xs'
                : 'bg-[var(--card-bg)] text-[var(--text3)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--sidebar-hover)]'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>{isEn ? 'International' : 'بین‌المللی'}</span>
            <span className="text-[10px] opacity-70">
              ({allServers.filter((d) => d.category === 'international').length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('secure')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              activeCategory === 'secure'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                : 'bg-[var(--card-bg)] text-[var(--text3)] hover:text-[var(--text)] border border-[var(--border)] hover:bg-[var(--sidebar-hover)]'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isEn ? 'Secure & Family' : 'امن و خانواده'}</span>
            <span className="text-[10px] opacity-70">
              ({allServers.filter((d) => d.category === 'secure').length})
            </span>
          </button>
        </div>

        {/* Action Buttons: Test All Speed & Add Custom DNS */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={handleTestAllSpeed}
            disabled={isTestingAll}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-xs transition-all shadow-xs cursor-pointer shrink-0 ${
              isTestingAll 
                ? 'bg-[var(--input-bg)] text-[var(--text3)] border border-[var(--border)] cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white shadow-sky-500/20 active:scale-98'
            }`}
          >
            {isTestingAll ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>{isEn ? 'Testing all...' : 'در حال تست سرعت...'}</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>{isEn ? 'Test All Speed' : 'تست سرعت همه'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAddFormOpen((prev) => !prev)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 border border-sky-500/30 transition cursor-pointer shrink-0 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isEn ? '+ Add Custom DNS' : '+ افزودن DNS دلخواه'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. INLINE ADD CUSTOM DNS FORM                                             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSaveCustomDns}
              className="rounded-2xl bg-[var(--card-bg)] border border-sky-500/30 p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border)]">
                <h3 className="text-sm font-bold text-[var(--text)] flex items-center gap-2">
                  <Plus className="w-4 h-4 text-sky-400" />
                  <span>{isEn ? 'Add Custom DNS Server' : 'افزودن دی‌ان‌اس دلخواه جدید'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  className="p-1 rounded-lg text-[var(--text3)] hover:text-[var(--text)] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Name */}
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text2)] block">
                    {isEn ? 'DNS Name *' : 'نام DNS *'}
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder={isEn ? 'e.g. My Private DNS' : 'مثلاً دی‌ان‌اس اختصاصی من'}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-blue-500 transition-colors"
                  />
                  {formErrors.name && (
                    <p className="text-[10px] text-rose-400">{formErrors.name}</p>
                  )}
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text2)] block">
                    {isEn ? 'Category' : 'دسته‌بندی'}
                  </label>
                  <Select
                    value={formCategory}
                    onChange={(val) => setFormCategory(val as DnsCategory)}
                    className="w-full"
                    options={[
                      { value: 'international', label: isEn ? 'International' : 'بین‌المللی' },
                      { value: 'antifilter', label: isEn ? 'Anti-filter & Sanctions' : 'ضدفیلتر و تحریم‌شکن' },
                      { value: 'secure', label: isEn ? 'Secure & Family' : 'امن و خانواده' },
                    ]}
                  />
                </div>

                {/* Primary IP */}
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text2)] block">
                    {isEn ? 'Primary IP *' : 'آی‌پی اول (Primary) *'}
                  </label>
                  <input
                    type="text"
                    value={formPrimary}
                    onChange={(e) => {
                      setFormPrimary(e.target.value);
                      if (formErrors.primary) setFormErrors((prev) => ({ ...prev, primary: undefined }));
                    }}
                    placeholder="1.1.1.1"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] font-mono outline-none placeholder:text-[var(--text3)] focus:border-blue-500 transition-colors text-left"
                  />
                  {formErrors.primary && (
                    <p className="text-[10px] text-rose-400">{formErrors.primary}</p>
                  )}
                </div>

                {/* Secondary IP */}
                <div className="space-y-1">
                  <label className="font-semibold text-[var(--text2)] block">
                    {isEn ? 'Secondary IP (Optional)' : 'آی‌پی دوم (Secondary - اختیاری)'}
                  </label>
                  <input
                    type="text"
                    value={formSecondary}
                    onChange={(e) => {
                      setFormSecondary(e.target.value);
                      if (formErrors.secondary) setFormErrors((prev) => ({ ...prev, secondary: undefined }));
                    }}
                    placeholder="1.0.0.1"
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--input-bg)] text-[var(--text)] font-mono outline-none placeholder:text-[var(--text3)] focus:border-blue-500 transition-colors text-left"
                  />
                  {formErrors.secondary && (
                    <p className="text-[10px] text-rose-400">{formErrors.secondary}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setIsAddFormOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition cursor-pointer"
                >
                  {isEn ? 'Cancel' : 'انصراف'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl text-xs font-medium bg-sky-500 hover:bg-sky-600 text-white transition shadow-xs cursor-pointer"
                >
                  {isEn ? 'Save DNS' : 'ذخیره دی‌ان‌اس'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 5. DNS CARDS GRID                                                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {displayList.map((dns) => {
            const isPinned = pinnedIds.includes(dns.id);
            const isSelected = selectedDnsId === dns.id;
            const ping = pingResults[dns.id];
            const bothIps = `${dns.primary}\n${dns.secondary}`;

            // Category badge helper
            const getCategoryBadge = () => {
              switch (dns.category) {
                case 'antifilter':
                  return (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
                      {isEn ? 'Anti-filter' : 'تحریم‌شکن'}
                    </span>
                  );
                case 'international':
                  return (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      {isEn ? 'Global' : 'بین‌المللی'}
                    </span>
                  );
                case 'secure':
                  return (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      {isEn ? 'Family / Secure' : 'امنیت و خانواده'}
                    </span>
                  );
              }
            };

            // Speed Badge Helper
            const renderSpeedBadge = () => {
              if (!ping) return null;
              if (ping.status === 'testing') {
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/30">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {isEn ? 'Testing...' : 'تست...'}
                  </span>
                );
              }
              if (ping.status === 'error' || ping.latency === undefined) {
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    <AlertCircle className="w-3 h-3" />
                    {isEn ? 'Timeout / Error' : 'خطا / بدون پاسخ'}
                  </span>
                );
              }

              const ms = ping.latency;
              if (ms < 150) {
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Zap className="w-3 h-3" />
                    {ms} ms ({isEn ? 'Fast' : 'سریع'})
                  </span>
                );
              }
              if (ms <= 350) {
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {ms} ms ({isEn ? 'Medium' : 'متوسط'})
                  </span>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                  {ms} ms ({isEn ? 'Slow' : 'کند'})
                </span>
              );
            };

            return (
              <motion.div
                key={dns.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`rounded-2xl bg-[var(--card-bg)] border p-4 shadow-xs flex flex-col justify-between gap-3 transition-all ${
                  isSelected
                    ? 'border-sky-500 ring-2 ring-sky-500/30 bg-[var(--card-bg)]'
                    : isPinned 
                    ? 'border-sky-500/50 ring-1 ring-sky-500/25 bg-[var(--card-bg)]' 
                    : 'border-[var(--border)] hover:border-[var(--text3)]/40'
                }`}
              >
                {/* Top: Name, Custom Badge, Pin, Trash & Category */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePin(dns.id)}
                        title={isPinned ? (isEn ? 'Unpin' : 'برداشتن سنجاق') : (isEn ? 'Pin to top' : 'سنجاق به بالا')}
                        className={`p-1 rounded-lg transition cursor-pointer ${
                          isPinned 
                            ? 'text-amber-400 hover:text-amber-500' 
                            : 'text-[var(--text3)] hover:text-amber-400'
                        }`}
                      >
                        <Star className="w-4 h-4" fill={isPinned ? 'currentColor' : 'none'} />
                      </button>

                      <h3 className="text-sm font-bold text-[var(--text)] tracking-tight">
                        {dns.name}
                      </h3>

                      {dns.isCustom && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                          {isEn ? 'Custom' : 'شخصی'}
                        </span>
                      )}

                      {dns.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomDns(dns.id)}
                          title={isEn ? 'Delete Custom DNS' : 'حذف دی‌ان‌اس شخصی'}
                          className="p-1 rounded-md text-[var(--text3)] hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {renderSpeedBadge()}
                      {getCategoryBadge()}
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text3)] mt-1.5 leading-relaxed">
                    {isEn ? dns.descriptionEn : dns.descriptionFa}
                  </p>
                </div>

                {/* Middle: IP Boxes */}
                <div className="space-y-1.5 bg-[var(--input-bg)]/60 rounded-xl p-2.5 border border-[var(--border)]">
                  {/* Primary IP */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[11px] text-[var(--text3)] font-mono shrink-0">
                      Primary:
                    </span>
                    <span className="font-mono text-[var(--text)] font-semibold tracking-wider select-all">
                      {dns.primary}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(dns.primary, `${dns.id}-primary`)}
                      title={isEn ? 'Copy Primary IP' : 'کپی آی‌پی اول'}
                      className="p-1 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--text3)] hover:text-[var(--text)] transition cursor-pointer shrink-0"
                    >
                      {copiedKey === `${dns.id}-primary` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Secondary IP */}
                  <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-[var(--border)]/50">
                    <span className="text-[11px] text-[var(--text3)] font-mono shrink-0">
                      Secondary:
                    </span>
                    <span className="font-mono text-[var(--text)] font-semibold tracking-wider select-all">
                      {dns.secondary}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(dns.secondary, `${dns.id}-secondary`)}
                      title={isEn ? 'Copy Secondary IP' : 'کپی آی‌پی دوم'}
                      className="p-1 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--text3)] hover:text-[var(--text)] transition cursor-pointer shrink-0"
                    >
                      {copiedKey === `${dns.id}-secondary` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Bottom: Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleCopy(bothIps, `${dns.id}-both`)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--input-bg)] hover:bg-[var(--sidebar-hover)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--text)] transition cursor-pointer"
                  >
                    {copiedKey === `${dns.id}-both` ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">{isEn ? 'Copied!' : 'کپی شد!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[var(--text3)]" />
                        <span>{isEn ? 'Copy Both' : 'کپی هر دو'}</span>
                      </>
                    )}
                  </button>

                  {/* Select to Connect Button */}
                  {isSelected ? (
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default select-none shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isEn ? '✓ Selected' : '✓ انتخاب شده'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectDns(dns.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--input-bg)] hover:bg-sky-500/20 hover:text-sky-400 border border-[var(--border)] hover:border-sky-500/40 text-[var(--text2)] transition cursor-pointer shadow-xs"
                    >
                      <span>{isEn ? 'Select to Connect' : 'انتخاب برای اتصال'}</span>
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ========================================================================= */}
      {/* 6. MODAL: DNS Selection Dialog                                            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            {/* Backdrop click to close */}
            <div 
              className="absolute inset-0" 
              onClick={() => setIsPickerOpen(false)}
              aria-hidden="true" 
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-full max-w-lg rounded-2xl bg-[var(--card-bg)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm md:text-base font-bold text-[var(--text)]">
                    {isEn ? 'Choose a DNS to connect' : 'انتخاب DNS برای اتصال'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--sidebar-hover)] transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal List Body */}
              <div className="p-3 overflow-y-auto space-y-2 divide-y divide-[var(--border)]/40">
                {allServers.map((server) => {
                  const isCurrent = server.id === selectedDnsId;
                  return (
                    <button
                      key={server.id}
                      type="button"
                      onClick={() => handleSelectDns(server.id)}
                      className={`w-full text-start p-3 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer ${
                        isCurrent
                          ? 'bg-sky-500/15 border border-sky-500/40 text-sky-400 shadow-xs'
                          : 'hover:bg-[var(--sidebar-hover)] text-[var(--text2)]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs md:text-sm text-[var(--text)] truncate">
                            {server.name}
                          </span>
                          {server.isCustom && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                              {isEn ? 'Custom' : 'شخصی'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text3)] truncate mt-0.5">
                          {isEn ? server.descriptionEn : server.descriptionFa}
                        </p>
                        <span className="font-mono text-[10px] text-[var(--text3)] opacity-75">
                          IP: {server.primary}
                        </span>
                      </div>

                      {isCurrent && (
                        <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
