import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMac(mac: string): string {
  const raw = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase()
  return raw.match(/.{1,2}/g)?.join(':') ?? mac.toUpperCase()
}
