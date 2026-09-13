// App version is sourced from app.json's "expo.version" field so it stays in
// sync with the build/release version. Falls back to a hardcoded value if the
// config can't be resolved (e.g. in some test environments).
function readAppVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appJson = require('../../app.json');
    return appJson?.expo?.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export const APP_VERSION = readAppVersion();