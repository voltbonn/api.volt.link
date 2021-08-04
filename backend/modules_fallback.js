
// require fallback
import { createRequireFromPath } from 'module'
export function require(...attr) {
  return createRequireFromPath(...attr)
}

// __dirname fallback
import { dirname } from 'path'
import { fileURLToPath } from 'url'
export const __dirname = dirname(fileURLToPath(import.meta.url))
