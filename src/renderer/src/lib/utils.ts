import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
