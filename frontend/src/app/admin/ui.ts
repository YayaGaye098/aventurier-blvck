import { Injectable, signal } from '@angular/core';

/** Petit service de notifications (toast) et de compteur de messages non lus. */
@Injectable({ providedIn: 'root' })
export class AdminUi {
  readonly toast = signal<{ text: string; err: boolean } | null>(null);
  readonly nonLus = signal(0);
  private timer?: ReturnType<typeof setTimeout>;

  notify(text: string, err = false) {
    this.toast.set({ text, err });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.toast.set(null), 3200);
  }
}

/** Tailles maximales acceptées par le serveur (garder en accord avec backend/app/config.py). */
export const MAX_PHOTO_MO = 20;
export const MAX_VIDEO_MO = 200;

/** Lit un fichier image et renvoie un aperçu (data URL). */
export function preview(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(file);
  });
}

export const ICONES = [
  'fa-compass', 'fa-person-hiking', 'fa-person-biking', 'fa-water', 'fa-umbrella-beach', 'fa-sun',
  'fa-tree', 'fa-mountain-sun', 'fa-ship', 'fa-fish', 'fa-camera', 'fa-landmark', 'fa-campground',
  'fa-horse', 'fa-car-side', 'fa-utensils', 'fa-music', 'fa-binoculars', 'fa-person-swimming', 'fa-map-location-dot',
];
