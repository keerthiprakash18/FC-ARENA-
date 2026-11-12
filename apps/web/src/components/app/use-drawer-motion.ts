'use client';

import { useEffect, useRef, type PointerEvent, type RefObject } from 'react';

type Drag = {
  id: number;
  x: number;
  y: number;
  offset: number;
  lastX: number;
  lastTime: number;
  velocity: number;
  active: boolean;
};

const stiffness = 380;
const damping = 38;

export function useDrawerMotion(dialog: RefObject<HTMLDialogElement | null>) {
  const position = useRef(0);
  const frame = useRef(0);
  const drag = useRef<Drag | null>(null);
  const lastSwipe = useRef(-Infinity);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function paint(offset: number) {
    const element = dialog.current;
    if (!element) return;
    position.current = offset;
    element.style.setProperty('--drawer-x', `${offset}px`);
    const progress = Math.min(1, Math.max(0, 1 + offset / Math.max(1, element.offsetWidth)));
    element.style.setProperty('--drawer-scrim', String(progress * 0.46));
  }

  function settle(target: number, velocity = 0, finished?: () => void) {
    cancelAnimationFrame(frame.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      paint(target);
      finished?.();
      return;
    }
    let previous = performance.now();
    function step(now: number) {
      const dt = Math.min(0.025, Math.max(0.001, (now - previous) / 1000));
      previous = now;
      const distance = target - position.current;
      velocity += (stiffness * distance - damping * velocity) * dt;
      paint(position.current + velocity * dt);
      if (Math.abs(distance) > 0.5 || Math.abs(velocity) > 5) {
        frame.current = requestAnimationFrame(step);
      } else {
        paint(target);
        finished?.();
      }
    }
    frame.current = requestAnimationFrame(step);
  }

  function open() {
    const element = dialog.current;
    if (!element || element.open) return;
    element.showModal();
    paint(-element.offsetWidth);
    settle(0);
  }

  function close(velocity = 0) {
    const element = dialog.current;
    if (element?.open) settle(-element.offsetWidth, velocity, () => element.close());
  }

  function reset() {
    cancelAnimationFrame(frame.current);
    drag.current = null;
    position.current = 0;
  }

  function pointerDown(event: PointerEvent<HTMLDialogElement>) {
    if (
      !event.isPrimary || event.button !== 0 ||
      event.target === event.currentTarget ||
      event.pointerType === 'mouse' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;
    drag.current = {
      id: event.pointerId, x: event.clientX, y: event.clientY, offset: position.current,
      lastX: event.clientX, lastTime: event.timeStamp, velocity: 0, active: false,
    };
  }

  function pointerMove(event: PointerEvent<HTMLDialogElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    if (!gesture.active) {
      const dy = Math.abs(event.clientY - gesture.y);
      if (dy > 9 && dy > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) <= 9 || Math.abs(dx) <= dy) return;
      gesture.active = true;
      gesture.offset = position.current;
      cancelAnimationFrame(frame.current);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const elapsed = event.timeStamp - gesture.lastTime;
    if (elapsed > 0) {
      const speed = 1000 * (event.clientX - gesture.lastX) / elapsed;
      gesture.velocity = Math.min(2400, Math.max(-2400, speed * 0.7 + gesture.velocity * 0.3));
      gesture.lastX = event.clientX;
      gesture.lastTime = event.timeStamp;
    }
    const offset = gesture.offset + dx;
    paint(offset > 0 ? 0 : Math.max(-event.currentTarget.offsetWidth, offset));
  }

  function pointerEnd(event: PointerEvent<HTMLDialogElement>, cancelled = false) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    drag.current = null;
    if (!gesture.active) return;
    lastSwipe.current = performance.now();
    const velocity = cancelled || event.timeStamp - gesture.lastTime > 85 ? 0 : gesture.velocity;
    const projected = position.current + velocity * 0.16;
    if (!cancelled && projected < -event.currentTarget.offsetWidth * 0.34) {
      close(velocity);
    } else {
      settle(0, velocity);
    }
  }

  return { open, close, reset, pointerDown, pointerMove, pointerEnd, didSwipe: () => performance.now() - lastSwipe.current < 350 };
}
