import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPace(secondsPerKm: number | null | undefined): string {
  if (!secondsPerKm) return "--:--";
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

export function formatDistance(meters: number | null | undefined): string {
  if (!meters) return "0.0";
  return (meters / 1000).toFixed(1);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getWorkoutTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    recovery: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    tempo: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    interval: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    long_run: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    rest: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    cross_training: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  };
  return colors[type] || colors.easy;
}
