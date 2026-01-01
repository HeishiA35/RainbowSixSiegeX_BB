function toggleWhatsSite() {
  const modal = document.querySelector('dialog.js-whatsSite');
  const openButton = document.getElementById('open--whatsSite');
  const closeButton = document.getElementById('close--whatsSite');

  openButton.addEventListener('click', () => {
    modal.showModal();
  })
  closeButton.addEventListener('click', () => {
    modal.close();
  })
};

toggleWhatsSite();