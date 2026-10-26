import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import WeekPanel from './WeekPanel';
import TasksListPanel from './TasksListPanel';
import ShoppingPanel from './ShoppingPanel';
import HabitsPanel from './HabitsPanel';
import HabitsWidget from './HabitsWidget';
import PomodoroTimer from './PomodoroTimer';
import { AppSettings, WeekExtras, WeekExtra, TaskItem } from '../types';

interface RoutinePanelProps {
  fixedDaily: string[];
  onUpdateFixedDaily: (newFixed: string[]) => void;
  weekExtras: WeekExtras;
  onAddExtra: (key: string, text: string) => void;
  onToggleExtra: (key: string, idx: number) => void;
  onDeleteExtra: (key: string, idx: number) => void;
  onReorderExtras?: (key: string, newExtras: WeekExtra[]) => void;
  todos: TaskItem[];
  shopping: TaskItem[];
  onAddTask: (type: 'todos' | 'shopping', text: string, priority?: 'urgent' | 'important' | 'normal', category?: string, quantity?: number, unit?: string) => void;
  onToggleTask: (type: 'todos' | 'shopping', idx: number) => void;
  onDeleteTask: (type: 'todos' | 'shopping', idx: number) => void;
  settings?: AppSettings;
  todayExtras: WeekExtra[];
  onToggleTodayExtra: (idx: number) => void;
  onAskAi?: (message: string) => void;
  initialView?: SubView;
  onNavigateToPanel?: (panelName: string) => void;
}

type SubView = 'overview' | 'week' | 'tasks' | 'shopping' | 'habits';

export default function RoutinePanel(props: RoutinePanelProps) {
  const { settings, fixedDaily, todayExtras, onToggleTodayExtra } = props;
  const isEn = settings?.language === 'en';
  const [view, setView] = useState<SubView>(props.initialView || 'overview');

  const BackButton = () => (
    <button
      type="button"
      onClick={() => {
        if (props.initialView && props.initialView !== 'overview') {
          props.onNavigateToPanel?.('home');
        } else {
          setView('overview');
        }
      }}
      className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)] hover:text-[var(--text)] mb-3 cursor-pointer"
    >
      <ArrowRight className="w-3.5 h-3.5" />
      {isEn ? 'Back to overview' : 'بازگشت به نمای کلی'}
    </button>
  );

  if (view === 'week') {
    return (
      <div>
        <BackButton />
        <WeekPanel
          key="routine-week"
          fixedDaily={props.fixedDaily}
          onUpdateFixedDaily={props.onUpdateFixedDaily}
          weekExtras={props.weekExtras}
          onAddExtra={props.onAddExtra}
          onToggleExtra={props.onToggleExtra}
          onDeleteExtra={props.onDeleteExtra}
          onReorderExtras={props.onReorderExtras}
          settings={props.settings}
        />
      </div>
    );
  }

  if (view === 'tasks') {
    return (
      <div>
        <BackButton />
        <TasksListPanel
          key="routine-tasks"
          todos={props.todos}
          onAddTask={props.onAddTask}
          onToggleTask={props.onToggleTask}
          onDeleteTask={props.onDeleteTask}
          settings={props.settings}
        />
      </div>
    );
  }

  if (view === 'shopping') {
    return (
      <div>
        <BackButton />
        <ShoppingPanel
          key="routine-shopping"
          shopping={props.shopping}
          onAddTask={props.onAddTask}
          onToggleTask={props.onToggleTask}
          onDeleteTask={props.onDeleteTask}
          settings={props.settings}
        />
      </div>
    );
  }

  if (view === 'habits') {
    return (
      <div>
        <BackButton />
        <HabitsPanel key="routine-habits" settings={props.settings} />
      </div>
    );
  }

  // Overview: asymmetric bento grid dashboard
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Habits widget (reused from Home) */}
      <div onClick={() => setView('habits')} className="cursor-pointer">
        <HabitsWidget
          onNavigateToHabits={() => setView('habits')}
          settings={props.settings}
        />
      </div>

      {/* Pomodoro Focus Timer */}
      <div className="rounded-3xl overflow-hidden h-full">
        <PomodoroTimer isEn={isEn} />
      </div>
    </div>
  );
}
