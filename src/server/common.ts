export function timestampToDate(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

export function dateToTimestamp(date: Date): number {
  return Math.round(date.getTime() / 1000);
}

export enum PathMode {
  Relative = 0,
  UnixAbsolute,
  WindowsAbsolute
}

export function pathMode(filepath: string): PathMode {
  if (filepath.startsWith('/')) {
    return PathMode.UnixAbsolute;
  } else if (filepath.match(/^[A-Za-z]:\//) != null || filepath.startsWith('\\')) {
    // Windows absolute paths start with drive letter (C:) and UNC paths have form of \\ServerName\path\to\a\file
    return PathMode.WindowsAbsolute;
  } else {
    return PathMode.Relative;
  }
}
