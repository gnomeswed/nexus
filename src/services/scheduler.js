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
   * List active reminders
   */
  listReminders() {
    const list = [];
    for (const [id, entry] of this.timers) {
      list.push({ id, title: entry.title, description: entry.description, triggerAt: entry.triggerAt, agentId: entry.agentId });
    }
    return list;
  }
}

module.exports = new Scheduler();
