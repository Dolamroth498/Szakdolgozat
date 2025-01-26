import { Routes } from '@angular/router';

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
        path: "store",
        loadComponent: () => import("./store/store.component").then(c => c.StoreComponent),
    },
    {
        path: "leaderboard",
        loadComponent: () => import("./leaderboard/leaderboard.component").then(c => c.LeaderboardComponent),
    },
    {
        path: "user",
        loadComponent: () => import("./user/user.component").then(c => c.UserComponent)
    },
    {
      path: "auth:action",
      loadComponent: () => import("./auth/auth.component").then(c => c.AuthComponent)
    },
    {
      path: "auth:action",
      loadComponent: () => import("./auth/auth.component").then(c => c.AuthComponent)
    },
    {
        path: "**",
        redirectTo: "main"
    }
];
