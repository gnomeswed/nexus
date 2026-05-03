// File Manager - Handles file operations for agents
const fs = require('fs');
const path = require('path');

class FileManager {
  constructor() {
    this.projectsRoot = path.resolve(process.env.PROJECTS_ROOT || './projects');
  }

  /**
   * Resolve a safe path within the project folder (prevents path traversal)
   */
  resolveSafe(projectFolder, relativePath) {
    const base = path.resolve(this.projectsRoot, projectFolder);
    const full = path.resolve(base, relativePath);
    if (!full.startsWith(base)) {
      throw new Error('Path traversal detected - access denied');
    }
    return full;
  }

  /**
   * Create or overwrite a file
   */
  createFile(projectFolder, relativePath, content) {
    const fullPath = this.resolveSafe(projectFolder, relativePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    return {
      success: true,
      path: relativePath,
      size: Buffer.byteLength(content, 'utf-8'),
      message: `File created: ${relativePath}`
    };
  }

  /**
   * Read a file
   */
  readFile(projectFolder, relativePath) {
    const fullPath = this.resolveSafe(projectFolder, relativePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File not found: ${relativePath}` };
    }
    const stat = fs.statSync(fullPath);
    if (stat.size > 500000) {
      return { success: false, message: `File too large (${stat.size} bytes). Max 500KB.` };
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    return { success: true, path: relativePath, content, size: stat.size };
  }

  /**
   * Edit a file (search and replace)
   */
  editFile(projectFolder, relativePath, search, replace) {
    const fullPath = this.resolveSafe(projectFolder, relativePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, message: `File not found: ${relativePath}` };
    }
    let content = fs.readFileSync(fullPath, 'utf-8');
    if (!content.includes(search)) {
      return { success: false, message: `Search text not found in ${relativePath}` };
    }
    content = content.replace(search, replace);
    fs.writeFileSync(fullPath, content, 'utf-8');
    return { success: true, path: relativePath, message: `File edited: ${relativePath}` };
  }

  /**
   * List files in a project folder
   */
  listFiles(projectFolder, subPath = '') {
    const base = path.resolve(this.projectsRoot, projectFolder);
    const dir = subPath ? path.resolve(base, subPath) : base;

    if (!dir.startsWith(base)) throw new Error('Path traversal detected');
    if (!fs.existsSync(dir)) return [];

    const results = [];
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      const stat = fs.statSync(full);
      const rel = path.relative(base, full).replace(/\\/g, '/');
      results.push({
        path: rel,
        type: stat.isDirectory() ? 'directory' : 'file',
        size: stat.isDirectory() ? 0 : stat.size
      });
      if (stat.isDirectory()) {
        results.push(...this.listFiles(projectFolder, rel));
      }
    }
    return results;
  }

  /**
   * Ensure project folder exists
   */
  ensureProjectFolder(folderName) {
    const fullPath = path.resolve(this.projectsRoot, folderName);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    return fullPath;
  }
}

module.exports = new FileManager();
