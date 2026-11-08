import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService, errorMessage } from '../core/api.service';
import { AdminUi } from './ui';

@Component({
  selector: 'app-compte',
  imports: [FormsModule],
  template: `
    <div class="adm-head"><div><h1>Mon compte</h1><p>Changez votre mot de passe régulièrement.</p></div></div>
    <form class="adm-card" style="max-width:460px;display:grid;gap:1rem" (ngSubmit)="valider()" #f="ngForm">
      <div class="field"><label for="a">Mot de passe actuel</label>
        <input id="a" name="a" class="input" type="password" required [(ngModel)]="ancien" autocomplete="current-password"></div>
      <div class="field"><label for="n">Nouveau mot de passe</label>
        <input id="n" name="n" class="input" type="password" required minlength="8" [(ngModel)]="nouveau" autocomplete="new-password">
        <span class="hint">8 caractères minimum.</span></div>
      <div class="field"><label for="c">Confirmer</label>
        <input id="c" name="c" class="input" type="password" required [(ngModel)]="confirmation" autocomplete="new-password"></div>
      @if (confirmation && confirmation !== nouveau) { <p class="alert alert-error">Les deux mots de passe ne correspondent pas.</p> }
      <button class="btn btn-primary" type="submit" [disabled]="saving() || f.invalid || confirmation !== nouveau">Mettre à jour</button>
    </form>

    <section class="adm-card" style="max-width:460px;margin-top:1.5rem;display:grid;gap:.8rem">
      <h2 style="font-size:1.15rem">Sauvegarde du site</h2>
      <p style="color:var(--muted);font-size:.9rem">
        Un fichier .zip avec la base de données (aventures, événements, hôtels, avis, messages…) et toutes
        les photos et vidéos. Gardez-en une copie sur votre ordinateur ou Google Drive, par exemple une fois par mois.</p>
      <button class="btn btn-ghost" type="button" (click)="telecharger()" [disabled]="backup()">
        @if (backup()) { <i class="fas fa-spinner fa-spin"></i> Préparation… } @else { <i class="fas fa-download"></i> Télécharger une sauvegarde }
      </button>
    </section>
  `,
})
export class Compte {
  private api = inject(ApiService);
  private ui = inject(AdminUi);
  ancien = '';
  nouveau = '';
  confirmation = '';
  saving = signal(false);
  backup = signal(false);

  telecharger() {
    this.backup.set(true);
    this.api.sauvegarde().subscribe({
      next: (r) => {
        const nom = /filename="?([^";]+)"?/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'sauvegarde.zip';
        const url = URL.createObjectURL(r.body!);
        const a = document.createElement('a');
        a.href = url;
        a.download = nom;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        this.backup.set(false);
        this.ui.notify('Sauvegarde téléchargée.');
      },
      error: () => { this.ui.notify('La sauvegarde a échoué. Réessayez.', true); this.backup.set(false); },
    });
  }

  valider() {
    this.saving.set(true);
    this.api.changePassword(this.ancien, this.nouveau).subscribe({
      next: () => {
        this.ui.notify('Mot de passe mis à jour.');
        this.ancien = this.nouveau = this.confirmation = '';
        this.saving.set(false);
      },
      error: (e) => { this.ui.notify(errorMessage(e), true); this.saving.set(false); },
    });
  }
}
