import { Component, HostListener, input, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { trackVisite } from '../core/track';

/** En-tête du site public. `overlay` : transparent au-dessus d'une grande photo, puis blanc au défilement. */
@Component({
  selector: 'app-site-header',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="topbar" [class.solid]="!overlay() || scrolled() || menuOpen()">
      <nav class="container nav">
        <a routerLink="/" class="brand" (click)="menuOpen.set(false)">
          <img src="/images/logo-icon.png" alt="" width="56" height="39">
          <span><b class="b-orange">Aventurier&nbsp;</b><b class="b-teal">Blvck</b></span>
        </a>
        <button class="burger" type="button" (click)="menuOpen.set(!menuOpen())"
                [attr.aria-expanded]="menuOpen()" aria-label="Menu">
          <i class="fas" [class.fa-bars]="!menuOpen()" [class.fa-xmark]="menuOpen()"></i>
        </button>
        <ul class="links" [class.open]="menuOpen()" (click)="menuOpen.set(false)">
          <li><a routerLink="/" fragment="departs">Départs</a></li>
          <li><a routerLink="/" fragment="aventures">Aventures</a></li>
          <li><a routerLink="/" fragment="hotels">Hôtels</a></li>
          <li><a routerLink="/" fragment="galerie">Galerie</a></li>
          <li><a routerLink="/blog" routerLinkActive="current">Blog</a></li>
          <li><a routerLink="/" fragment="apropos">À propos</a></li>
          <li><a routerLink="/" fragment="contact" class="btn btn-primary btn-sm">Réserver</a></li>
        </ul>
      </nav>
    </header>
    @if (!overlay()) { <div class="spacer"></div> }
  `,
  styles: `
    .topbar { position: fixed; inset: 0 0 auto; z-index: 50; transition: background .3s, box-shadow .3s; }
    .topbar.solid { background: rgba(255,255,255,.96); backdrop-filter: blur(10px); box-shadow: 0 1px 0 var(--line); }
    .spacer { height: 72px; }
    .nav { display: flex; align-items: center; justify-content: space-between; height: 72px; }
    .brand { display: flex; align-items: center; gap: .6rem; text-decoration: none; font-family: var(--font-display); font-size: 1.25rem; letter-spacing: .02em; }
    .brand img { width: 56px; height: auto; }
    .b-orange { color: var(--orange); }
    .b-teal { color: var(--teal-bright); }
    .solid .b-teal { color: var(--teal); }
    .links { display: flex; align-items: center; gap: 1.8rem; list-style: none; margin: 0; padding: 0; }
    .links a:not(.btn) { color: #fff; text-decoration: none; font-weight: 600; font-size: .95rem; opacity: .92; }
    .links a:not(.btn):hover, .links a.current { opacity: 1; text-decoration: underline; text-underline-offset: 6px; text-decoration-thickness: 2px; }
    .solid .links a:not(.btn) { color: var(--ink); }
    .solid .links a.current { color: var(--teal); }
    .burger { display: none; background: none; border: 0; font-size: 1.4rem; color: #fff; cursor: pointer; padding: .5rem; }
    .solid .burger { color: var(--ink); }
    @media (max-width: 820px) {
      .burger { display: block; }
      .links { position: absolute; top: 72px; left: 0; right: 0; flex-direction: column; align-items: stretch; gap: 0;
        background: #fff; padding: .5rem 1.25rem 1.25rem; box-shadow: 0 12px 24px rgba(0,0,0,.08); display: none; }
      .links.open { display: flex; }
      .links a:not(.btn) { color: var(--ink); display: block; padding: .85rem 0; border-bottom: 1px solid var(--line); }
      .links .btn { margin-top: 1rem; width: 100%; }
    }
  `,
})
export class SiteHeader {
  overlay = input(false);
  scrolled = signal(false);
  menuOpen = signal(false);

  constructor() { trackVisite(); }

  @HostListener('window:scroll')
  onScroll() { this.scrolled.set(window.scrollY > 40); }
}
