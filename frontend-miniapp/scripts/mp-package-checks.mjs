const MiB = 1024 * 1024;

export function findCrossPackageImports(graph) {
  const owners = new Map(graph.files.map(file => [file.path, file.subPackage]));
  const violations = [];
  for (const module of graph.modules) {
    if (!owners.has(module.path)) continue;
    for (const dependency of module.deps) {
      // Rule edges describe page registration; file/JSON edges describe runtime imports.
      if (dependency.from === 'rule') continue;
      const targetPackage = owners.get(dependency.path);
      if (targetPackage && targetPackage !== owners.get(module.path)) {
        violations.push({ from: module.path, to: dependency.path });
      }
    }
  }
  return violations;
}

export function measurePackages(files, app) {
  const roots = (app.subPackages || app.subpackages || []).map(
    ({ root }) => `${root.replace(/\/$/, '')}/`
  );
  const sizes = new Map([['__APP__', 0], ...roots.map(root => [root, 0])]);
  for (const [filename, content] of Object.entries(files)) {
    if (filename.endsWith('.js.map')) continue;
    const relativePath = filename.replace(/^\//, '');
    const name = roots.find(root => relativePath.startsWith(root)) || '__APP__';
    sizes.set(name, sizes.get(name) + Buffer.byteLength(content));
  }
  return Array.from(sizes, ([name, size]) => {
    const limit = (name === '__APP__' ? 1.5 : 2) * MiB;
    return {
      name,
      size,
      limit,
      headroom: limit - size,
      success: name === '__APP__' ? size < limit : size <= limit,
    };
  });
}
