/** Check lockfile metadata against the root manifest, without resolving the registry. */
export function lockfileProblems(manifest, lock) {
  const errors = [];
  if (!lock || typeof lock !== 'object') return ['Missing or invalid package-lock.json'];
  if (lock.lockfileVersion !== 3) errors.push('Expected npm lockfileVersion 3');
  const root = lock.packages?.[''];
  if (!root) return [...errors, 'Missing root packages[""] entry in lockfile'];
  if (root.name !== manifest.name) errors.push('Lockfile root package name differs from package.json');
  if (root.version !== manifest.version) errors.push('Lockfile root version differs from package.json');
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const actual = manifest[group] ?? {};
    const locked = root[group] ?? {};
    const names = new Set([...Object.keys(actual), ...Object.keys(locked)]);
    for (const name of names) {
      if (actual[name] !== locked[name]) {
        errors.push(`${group}.${name} is out of sync with package.json`);
      }
    }
  }
  return errors;
}
