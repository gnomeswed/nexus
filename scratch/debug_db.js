const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'data', 'nexus.db');
const db = new Database(dbPath);

console.log('--- PROJECTS ---');
const projects = db.prepare('SELECT id, name, status, roadmap FROM projects').all();
projects.forEach(p => {
    console.log(`ID: ${p.id} | Name: ${p.name} | Status: ${p.status}`);
    console.log(`Roadmap: ${p.roadmap}`);
    console.log('----------------');
});

console.log('\n--- TASKS ---');
const tasks = db.prepare('SELECT id, project_id, title, status, agent_id FROM tasks ORDER BY id DESC LIMIT 5').all();
tasks.forEach(t => {
    console.log(`ID: ${t.id} | Project: ${t.project_id} | Title: ${t.title} | Status: ${t.status} | Agent: ${t.agent_id}`);
});

console.log('\n--- RECENT MESSAGES ---');
const msgs = db.prepare('SELECT role, content FROM messages ORDER BY id DESC LIMIT 10').all();
msgs.reverse().forEach(m => {
    console.log(`[${m.role}]: ${m.content.substring(0, 100)}...`);
});
