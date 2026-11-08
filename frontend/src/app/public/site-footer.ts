import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AGENCE } from '../core/models';
import { track } from '../core/track';

@Component({
  selector: 'app-site-footer',
  imports: [RouterLink],
  template: `
    <footer class="footer">
      <div class="container footer-inner">
        <img src="/images/logo.webp" alt="Aventurier Blvck – Travel Agency" width="150" height="124" loading="lazy">
        <nav class="flinks" aria-label="Pied de page">
          <a routerLink="/" fragment="aventures">Aventures</a>
          <a routerLink="/" fragment="hotels">Hôtels</a>
          <a routerLink="/blog">Blog</a>
          <a routerLink="/" fragment="contact">Contact</a>
        </nav>
        <div class="socials">
          <a [href]="agence.instagram" target="_blank" rel="noopener" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
          <a [href]="agence.tiktok" target="_blank" rel="noopener" aria-label="TikTok"><i class="fab fa-tiktok"></i></a>
          @if (agence.facebook) { <a [href]="agence.facebook" target="_blank" rel="noopener" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a> }
          @if (agence.youtube) { <a [href]="agence.youtube" target="_blank" rel="noopener" aria-label="YouTube"><i class="fab fa-youtube"></i></a> }
        </div>
        <p class="copy">© {{ annee }} Aventurier Blvck · Tous droits réservés</p>
      </div>
    </footer>
    @if (agence.whatsapp) {
      <a class="wa-float" [href]="'https://wa.me/' + agence.whatsapp + '?text=' + texteWa" target="_blank" rel="noopener"
         aria-label="Nous écrire sur WhatsApp" (click)="suivre()">
        <i class="fab fa-whatsapp"></i>
      </a>
    }
  `,
  styles: `
    .footer { background: var(--teal-mist); border-top: 1px solid var(--line); padding: 3rem 0 2rem; }
    .footer-inner { display: flex; flex-direction: column; align-items: center; gap: 1.2rem; text-align: center; }
    img { width: 150px; height: auto; }
    .flinks { display: flex; flex-wrap: wrap; justify-content: center; gap: .4rem 1.4rem; }
    .flinks a { color: var(--ink); text-decoration: none; font-weight: 600; font-size: .92rem; }
    .flinks a:hover { color: var(--teal); }
    .socials { display: flex; gap: .6rem; }
    .socials a { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; background: #fff; color: var(--teal); border: 1px solid var(--line); text-decoration: none; transition: .2s; }
    .socials a:hover { background: var(--teal); color: #fff; }
    .copy { color: var(--muted); font-size: .85rem; }
    .copy a { color: var(--muted); }
    .wa-float { position: fixed; right: 18px; bottom: 18px; z-index: 60; width: 58px; height: 58px; border-radius: 50%;
      display: grid; place-items: center; background: #25d366; color: #fff; font-size: 1.9rem; text-decoration: none;
      box-shadow: 0 10px 24px rgba(0,0,0,.25); transition: transform .2s; animation: wa-in .5s ease .8s both; }
    .wa-float:hover { transform: scale(1.08); }
    @keyframes wa-in { from { opacity: 0; transform: translateY(20px) scale(.8); } }
  `,
})
export class SiteFooter {
  readonly agence = AGENCE;
  readonly annee = new Date().getFullYear();
  readonly texteWa = encodeURIComponent('Bonjour Aventurier Blvck, je souhaite avoir des informations sur vos sorties.');

  suivre() { track('whatsapp', 'Bouton flottant'); }
}
