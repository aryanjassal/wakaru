import type { Renderable } from '@opentui/core';
import type { ReactNode, RefObject } from 'react';

import { CliRenderEvents } from '@opentui/core';
import { useKeyboard, useRenderer } from '@opentui/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type FocusHandler = () => void;

type FocusRegistration = Readonly<{
  id: string;
  scope: string;
  target: Renderable;
  onFocus: FocusHandler;
  onBlur: FocusHandler;
}>;

export type FocusManager = Readonly<{
  focusedId: string | null;
  focus: (id: string) => boolean;
  blur: () => void;
  focusNext: () => boolean;
  focusPrevious: () => boolean;
}>;

type FocusContextValue = FocusManager &
  Readonly<{
    register: (registration: FocusRegistration) => () => void;
  }>;

type UseFocusableOptions<T extends Renderable> = Readonly<{
  id: string;
  ref: RefObject<T | null>;
  scope?: string | undefined;
  onFocus?: FocusHandler | undefined;
  onBlur?: FocusHandler | undefined;
}>;

const DEFAULT_FOCUS_SCOPE = 'route';
const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({
  activeScope = DEFAULT_FOCUS_SCOPE,
  children,
}: Readonly<{
  activeScope?: string;
  children: ReactNode;
}>) {
  const renderer = useRenderer();
  const registrationsRef = useRef(new Map<string, FocusRegistration>());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const canFocus = useCallback(
    ({ scope, target }: FocusRegistration) =>
      scope === activeScope &&
      target.visible &&
      target.focusable &&
      !target.isDestroyed,
    [activeScope]
  );

  const register = useCallback(
    (registration: FocusRegistration) => {
      const registrations = registrationsRef.current;
      const existing = registrations.get(registration.id);
      if (existing && existing.target !== registration.target) {
        throw new Error(`Duplicate focus target id: ${registration.id}`);
      }

      registrations.set(registration.id, registration);
      if (renderer.currentFocusedRenderable === registration.target) {
        registration.onFocus();
        setFocusedId(registration.id);
      }

      return () => {
        if (registrations.get(registration.id) !== registration) return;
        registrations.delete(registration.id);
        if (renderer.currentFocusedRenderable === registration.target) {
          registration.onBlur();
        }
        setFocusedId((current) =>
          current === registration.id ? null : current
        );
      };
    },
    [renderer]
  );

  const focus = useCallback(
    (id: string): boolean => {
      const registration = registrationsRef.current.get(id);
      if (!registration || !canFocus(registration)) return false;
      registration.target.focus();
      return true;
    },
    [canFocus]
  );

  const blur = useCallback((): void => {
    renderer.currentFocusedRenderable?.blur();
  }, [renderer]);

  const moveFocus = useCallback(
    (direction: 1 | -1): boolean => {
      const targets = [...registrationsRef.current.values()].filter(canFocus);
      if (!targets.length) return false;

      const currentIndex = targets.findIndex(
        ({ target }) => target === renderer.currentFocusedRenderable
      );
      const nextIndex =
        currentIndex < 0
          ? direction > 0
            ? 0
            : targets.length - 1
          : (currentIndex + direction + targets.length) % targets.length;
      targets[nextIndex]?.target.focus();
      return true;
    },
    [canFocus, renderer]
  );

  const focusNext = useCallback(() => moveFocus(1), [moveFocus]);
  const focusPrevious = useCallback(() => moveFocus(-1), [moveFocus]);

  useEffect(() => {
    const handleFocusedRenderable = (
      current: Renderable | null,
      previous: Renderable | null
    ) => {
      const registrations = [...registrationsRef.current.values()];
      const previousRegistration = registrations.find(
        ({ target }) => target === previous
      );
      const currentRegistration = registrations.find(
        ({ target }) => target === current
      );

      if (previousRegistration !== currentRegistration) {
        previousRegistration?.onBlur();
        currentRegistration?.onFocus();
      }
      setFocusedId(currentRegistration?.id ?? null);
    };

    renderer.on(CliRenderEvents.FOCUSED_RENDERABLE, handleFocusedRenderable);
    return () => {
      renderer.off(CliRenderEvents.FOCUSED_RENDERABLE, handleFocusedRenderable);
    };
  }, [renderer]);

  useKeyboard((key) => {
    if (key.eventType === 'release' || key.name !== 'tab') return;
    const moved = key.shift ? focusPrevious() : focusNext();
    if (!moved) return;

    key.preventDefault();
    key.stopPropagation();
  });

  const value = useMemo(
    () => ({
      focusedId,
      register,
      focus,
      blur,
      focusNext,
      focusPrevious,
    }),
    [blur, focus, focusedId, focusNext, focusPrevious, register]
  );

  return (
    <FocusContext.Provider value={value}>{children}</FocusContext.Provider>
  );
}

export function useFocusManager(): FocusManager {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocusManager must be used inside FocusProvider.');
  }
  return context;
}

export function useFocusable<T extends Renderable>({
  id,
  ref,
  scope = DEFAULT_FOCUS_SCOPE,
  onFocus,
  onBlur,
}: UseFocusableOptions<T>): boolean {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error('useFocusable must be used inside FocusProvider.');
  }

  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  onFocusRef.current = onFocus;
  onBlurRef.current = onBlur;

  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    return context.register({
      id,
      scope,
      target,
      onFocus: () => onFocusRef.current?.(),
      onBlur: () => onBlurRef.current?.(),
    });
  }, [context.register, id, ref, scope]);

  return context.focusedId === id;
}
