import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, throwError } from 'rxjs';
import { ApiService } from './api.service';

const KEY = 'ab_token';

function readToken(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  readonly token = signal<string | null>(readToken());

  login(username: string, password: string) {
    return this.api.login(username, password).pipe(
      map((r) => {
        this.token.set(r.access_token);
        try { localStorage.setItem(KEY, r.access_token); } catch {}
        return true;
      }),
    );
  }

  logout() {
    this.token.set(null);
    try { localStorage.removeItem(KEY); } catch {}
    this.router.navigate(['/admin/login']);
  }
}

/** Ajoute le jeton aux appels admin et renvoie vers la connexion s'il a expiré. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();
  const isAdmin = req.url.startsWith('/api/admin') && !req.url.endsWith('/login');
  if (token && isAdmin) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && isAdmin) auth.logout();
      return throwError(() => err);
    }),
  );
};

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token() ? true : inject(Router).createUrlTree(['/admin/login']);
};
