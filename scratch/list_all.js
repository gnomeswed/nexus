const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'nexus.db');
const db = new Database(dbPath);

console.log('--- ALL PROJECTS ---');
const projects = db.prepare('SELECT id, name, status FROM projects').all();
console.table(projects);

console.log('\n--- ALL TASKS ---');
const tasks = db.prepare('SELECT id, project_id, title, status, agent_id FROM tasks').all();
console.table(tasks);

console.log('\n--- ALL AGENTS ---');
const agents = db.prepare('SELECT id, name, role FROM agents').all();
console.table(agents);
