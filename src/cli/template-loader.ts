/**
 * Template loading and placeholder replacement for Swift code generation
 *
 * Uses simple {{PLACEHOLDER}} markers with string.replace() — no template engine dependency.
 * Templates are .swift.template files in the templates/ directory.
 */

import * as fs from 'fs';
import * as path from 'path';

const templateCache = new Map<string, string>();

/**
 * Resolves the path to a template file, checking multiple locations.
 * Works in both dev (src/cli/) and production (scripts/cli/) contexts.
 */
function resolveTemplatePath(name: string): string {
  const candidates = [
    path.resolve(__dirname, 'templates', name),
    path.resolve(__dirname, '..', 'cli', 'templates', name),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Template "${name}" not found. Searched:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
  );
}

/**
 * Loads a template file by name. Results are cached in memory.
 *
 * @param name - Template filename (e.g., 'CodableValue.swift.template')
 * @returns The template content as a string
 */
export function loadTemplate(name: string): string {
  const cached = templateCache.get(name);
  if (cached !== undefined) {
    return cached;
  }

  const templatePath = resolveTemplatePath(name);
  const content = fs.readFileSync(templatePath, 'utf-8');
  templateCache.set(name, content);
  return content;
}

/**
 * Replaces {{KEY}} placeholders in a template with provided values.
 * Throws if any placeholder in the template has no corresponding entry in values.
 *
 * @param template - Template string with {{KEY}} placeholders
 * @param values - Map of placeholder keys to replacement values
 * @returns The template with all placeholders replaced
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>
): string {
  // Find all placeholders in the template
  const placeholderPattern = /\{\{([A-Z_][A-Z0-9_]*)\}\}/g;
  const missingKeys: string[] = [];

  const result = template.replace(placeholderPattern, (match, key: string) => {
    if (!(key in values)) {
      missingKeys.push(key);
      return match;
    }
    return values[key]!;
  });

  if (missingKeys.length > 0) {
    const unique = [...new Set(missingKeys)];
    throw new Error(
      `Missing template values for placeholders: ${unique.join(', ')}`
    );
  }

  return result;
}

/**
 * Clears the template cache. Useful for testing.
 */
export function clearTemplateCache(): void {
  templateCache.clear();
}
