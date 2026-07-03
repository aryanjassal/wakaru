import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

export function expandHome(path: string): string {
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

export function resolveUserPath(path: string): string {
  return resolve(expandHome(path));
}

export async function ensureDirectory(path: string): Promise<string> {
  const resolvedPath = resolveUserPath(path);
  await mkdir(resolvedPath, { recursive: true });
  return resolvedPath;
}
