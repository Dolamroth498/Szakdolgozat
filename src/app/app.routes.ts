import { Routes } from '@angular/router';
import { authenticatedGuard } from './auth/auth.guard';

export const routes: Routes = [
    {
        path: "main",
        loadComponent: () => import("./main/main.component").then(c => c.MainComponent)
    },
    {
        path: "game",
        loadComponent: () => import("./game/game.component").then(c => c.GameComponent),
    },
    {
        path: "user",
        canActivate: [authenticatedGuard],
        loadComponent: () => import("./user/user.component").then(c => c.UserComponent)
    },
    {
      path: "auth/:action",
      loadComponent: () => import("./auth/auth.component").then(c => c.AuthComponent)
    },
    {
        path: "**",
        redirectTo: "main"
    }
];
