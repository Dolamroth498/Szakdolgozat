import { Routes } from '@angular/router';
import { authenticatedGuard } from './auth/auth.guard';
import { gameExitGuard } from './game/game.guard';

export const routes: Routes = [
    {
        path: "main",
        loadComponent: () => import("./main/main.component").then(c => c.MainComponent)
    },
    {
        path: "game",
        canDeactivate: [gameExitGuard],
        loadComponent: () => import("./game/game.component").then(c => c.GameComponent),
    },
    {
        path: "user",
        canActivate: [authenticatedGuard],
        loadComponent: () => import("./user/user.component").then(c => c.UserComponent)
    },
    {
        path: "store",
        canActivate: [authenticatedGuard],
        loadComponent: () => import("./store/store.component").then(c => c.StoreComponent)
    },
    {
        path: "leaderboard",
        loadComponent: () => import("./leaderboard/leaderboard.component").then(c => c.LeaderboardComponent)
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
