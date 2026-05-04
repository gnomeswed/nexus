// Scheduler - Reminders and periodic agent tasks
class Scheduler {
  constructor() {
    this.timers = new Map();
    this.db = null;
    this.io = null;
  }

  init(db, io) {
    this.db = db;
    this.io = io;
  }

  /**
   * Schedule a reminder
   */
  addReminder(title, description, triggerAt, agentId = null) {
    const id = Date.now().toString(36);
    const delay = new Date(triggerAt).getTime() - Date.now();

    if (delay <= 0) return { error: 'Trigger time must be in the future' };

    const timer = setTimeout(() => {
      this.fireReminder(id, title, description, agentId);
      this.timers.delete(id);
    }, delay);

    this.timers.set(id, { timer, title, description, triggerAt, agentId });

    return { success: true, id, title, triggerAt };
  }

  /**
   * Fire a reminder notification
   */
  fireReminder(id, title, description, agentId) {
    if (this.io) {
      this.io.emit('reminder:fire', { id, title, description, agentId, firedAt: new Date().toISOString() });
    }

    // Save as system message
    if (this.db) {
      this.db.prepare(`
        INSERT INTO messages (context_type, context_id, agent_id, role, content)
        VALUES ('global', 0, ?, 'system', ?)
      `).run(agentId, `⏰ Lembrete: ${title}${description ? '\n' + description : ''}`);
    }
  }

  /**
   * Cancel a reminder
   */
  cancelReminder(id) {
    const entry = this.timers.get(id);
    if (entry) {
      clearTimeout(entry.timer);
      this.timers.delete(id);
      return { success: true };
    }
    return { error: 'Reminder not found' };
  }

  /**
   * Start the autonomous heartbeat (Ping system)
   * This wakes up the Manager agent periodically to check for pending tasks
   */
  startHeartbeat(intervalMinutes = 10) {
    console.log(`[Scheduler] Heartbeat started (Every ${intervalMinutes} minutes)`);
    
    setInterval(async () => {
      if (!this.db || !this.io) return;

      console.log('[Scheduler] Heartbeat: Checking for pending work...');
      
      try {
        // Find projects that have pending or in_progress tasks
        const activeProjects = this.db.prepare(`
          SELECT DISTINCT p.id, p.name 
          FROM projects p
          JOIN tasks t ON p.id = t.project_id
          WHERE t.status IN ('pending', 'in_progress')
          AND p.status != 'completed'
        `).all();

        for (const project of activeProjects) {
          const orchestrator = require('./orchestrator');
          const manager = orchestrator.findContextAgent('project', project.id);
          
          if (manager) {
            // Check if there was any message in the last 10 minutes to avoid spamming
            const tenMinutesAgo = new Date(Date.now() - intervalMinutes * 60 * 1000).toISOString();
            const recentMsgs = this.db.prepare(`
              SELECT count(*) as c FROM messages 
              WHERE context_type = 'project' AND context_id = ? 
              AND created_at > ?
            `).get(project.id, tenMinutesAgo);

            if (recentMsgs.c === 0) {
              console.log(`[Scheduler] Heartbeat: Pinging Manager for project "${project.name}"`);
              
              // We don't await this to avoid blocking the heartbeat loop
              orchestrator.processMessage(
                'project', 
                project.id, 
                `SISTEMA (Heartbeat): Existem tarefas pendentes ou em andamento no Roadmap deste projeto. Verifique o status das tarefas delegadas e pressione os agentes se necessário, ou continue o trabalho você mesmo.`, 
                manager.id
              ).catch(err => console.error(`[Scheduler] Heartbeat error for project ${project.id}:`, err.message));
            }
          }
        }
      } catch (err) {
        console.error('[Scheduler] Heartbeat internal error:', err.message);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

module.exports = new Scheduler();
