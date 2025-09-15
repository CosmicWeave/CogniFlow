/*
// This file is part of an unused routing system and can be safely deleted.
// The active router is implemented in `AppRouter.tsx` using `contexts/RouterContext.tsx`.

// services/routerService.ts
import { RouteConfig } from '../routes';

export interface PathMatch {
  route: RouteConfig;
  params: Record<string, string>;
}

export function matchRoute(routes: RouteConfig[], pathname: string): PathMatch | null {
  for (const route of routes) {
    const routeParts = route.path.split('/').filter(Boolean);
    const pathParts = pathname.split('/').filter(Boolean);

    if (routeParts.length !== pathParts.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let isMatch = true;

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart.startsWith(':')) {
        const paramName = routePart.substring(1);
        params[paramName] = pathPart;
      } else if (routePart !== pathPart) {
        isMatch = false;
        break;
      }
    }

    if (isMatch) {
      return { route, params };
    }
  }

  return null;
}
*/
