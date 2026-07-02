const DEV_ONLY_ROUTES = new Set(['typography-preview', '/(main)/typography-preview']);

export function canOpenRouteInBuild(routeName: string, devMode: boolean): boolean {
  return devMode || !DEV_ONLY_ROUTES.has(routeName);
}

