// Modal system
const Modal = {
  show(content) {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-content');
    container.innerHTML = content;
    overlay.classList.add('active');
  },

  close() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
  },

  confirm(title, message, onConfirm) {
    this.show(`
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" onclick="Modal.close()">×</button>
      </div>
      <div class="modal-body">
        <p style="color:var(--text-secondary)">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close()">Cancelar</button>
        <button class="btn btn-danger" id="modal-confirm-btn">Confirmar</button>
      </div>
    `);
    document.getElementById('modal-confirm-btn').onclick = () => {
      Modal.close();
      onConfirm();
    };
  }
};

// Close modal on overlay click
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) Modal.close();
});
