// Scheduler - Reminders and periodic agent tasks
class Scheduler {
  constructor() {
    this.timers = new Map();
    this.db = null;
    this.io = null;
    this.orchestrator = null;
    this.heartbeatInterval = null;
  }

  init(db, io) {
    this.db = db;
    this.io = io;
  }

  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
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
   */
  startHeartbeat(intervalMinutes = 10) {
    console.log(`[Scheduler] Heartbeat started (Every ${intervalMinutes} minutes)`);
    
    this.heartbeatInterval = setInterval(async () => {
      if (!this.db || !this.io || !this.orchestrator) return;

      console.log('[Scheduler] Heartbeat: Checking for pending work...');
      
      try {
        const activeProjects = this.db.prepare(`
          SELECT DISTINCT p.id, p.name 
          FROM projects p
          JOIN tasks t ON p.id = t.project_id
          WHERE t.status IN ('pending', 'in_progress')
          AND p.status != 'completed'
        `).all();

        for (const project of activeProjects) {
          const manager = this.orchestrator.findContextAgent('project', project.id);
          
          if (manager) {
            const tenMinutesAgo = new Date(Date.now() - intervalMinutes * 60 * 1000).toISOString();
            const recentMsgs = this.db.prepare(`
              SELECT count(*) as c FROM messages 
              WHERE context_type = 'project' AND context_id = ? 
              AND created_at > ?
            `).get(project.id, tenMinutesAgo);

            if (recentMsgs.c === 0) {
              console.log(`[Scheduler] Heartbeat: Pinging Manager for project "${project.name}"`);
              
              this.orchestrator.processMessage(
                'project', 
                project.id, 
                `SISTEMA (Heartbeat): Existem tarefas pendentes ou em andamento no Roadmap deste projeto. Verifique o status das tarefas delegadas e pressione os agentes se necessário, ou continue o trabalho você mesmo.`, 
                manager.id
              ).catch(err => console.error(`[Scheduler] Heartbeat error for project ${project.id}:`, err.message));
            }
          }
        }

        // NEW: Check for independent tasks (Tareas Avulsas)
        const activeTasks = this.db.prepare(`
          SELECT id, title, agent_id FROM tasks 
          WHERE status = 'in_progress' 
          AND project_id IS NULL
        `).all();

        for (const task of activeTasks) {
          const tenMinutesAgo = new Date(Date.now() - intervalMinutes * 60 * 1000).toISOString();
          const recentMsgs = this.db.prepare(`
            SELECT count(*) as c FROM messages 
            WHERE context_type = 'task' AND context_id = ? 
            AND created_at > ?
          `).get(task.id, tenMinutesAgo);

          if (recentMsgs.c === 0) {
            console.log(`[Scheduler] Heartbeat: Pinging Agent for task "${task.title}"`);
            const agentId = task.agent_id || this.orchestrator.findContextAgent('task', task.id)?.id;
            
            if (agentId) {
              this.orchestrator.processMessage(
                'task',
                task.id,
                `SISTEMA (Heartbeat): Esta tarefa avulsa está 'em andamento' mas não teve atividade nos últimos ${intervalMinutes} minutos. Se você teve um erro de timeout, por favor, verifique onde parou e retome o trabalho. Se já terminou, atualize o status para 'review_pending'.`,
                agentId
              ).catch(err => console.error(`[Scheduler] Heartbeat error for task ${task.id}:`, err.message));
            }
          }
        }
      } catch (err) {
        console.error('[Scheduler] Heartbeat internal error:', err.message);
      }
    }, intervalMinutes * 60 * 1000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('[Scheduler] Heartbeat stopped');
    }
    // Clear all reminders
    for (const [id, entry] of this.timers) {
      clearTimeout(entry.timer);
    }
    this.timers.clear();
  }
}

module.exports = new Scheduler();
