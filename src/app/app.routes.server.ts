import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'user',
    renderMode: RenderMode.Client
  },
  {
    path: 'store',
    renderMode: RenderMode.Client
  },
  {
    path: 'auth/:action',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
