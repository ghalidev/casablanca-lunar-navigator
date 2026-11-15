/** Where Mission mode was left, so every tool page can send you back to the same shot. */
export function lastMissionUrl() {
  try {
    return sessionStorage.getItem('lastlight:mission') || '/'
  } catch {
    return '/'
  }
}
export function rememberMission(url: string) {
  try {
    sessionStorage.setItem('lastlight:mission', url)
  } catch {
    /* private mode: fall back to "/" */
  }
}

