import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '@/utils/cn';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used within <Tabs>');
  return ctx;
}

export interface TabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value: controlled,
  onValueChange,
  children,
  className,
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;

  const setValue = useCallback(
    (next: string) => {
      if (controlled === undefined) setUncontrolled(next);
      onValueChange?.(next);
    },
    [controlled, onValueChange],
  );

  const ctx = useMemo(() => ({ value, setValue }), [value, setValue]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-[#151820] p-1',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  value,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { value: active, setValue } = useTabsContext();
  const selected = active === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => setValue(value)}
      className={cn(
        'rounded-sm px-3 py-1.5 text-sm font-medium transition-colors',
        selected
          ? 'border-primary bg-card text-white shadow-card'
          : 'border-transparent text-muted hover:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { value: active } = useTabsContext();
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={cn('mt-4 animate-fade-in', className)} {...props}>
      {children}
    </div>
  );
}
