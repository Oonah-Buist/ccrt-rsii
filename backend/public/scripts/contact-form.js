// Contact form functionality via backend API
// Replaces previous mailto approach

document.addEventListener('DOMContentLoaded', function() {
  const contactForm = document.getElementById('contactForm');
  if (!contactForm) return;

  contactForm.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(contactForm);
    const payload = Object.fromEntries(formData.entries());

    const btn = contactForm.querySelector('.form-btn');
    const original = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Send failed');
      alert('Thanks! Your message has been sent.');
      contactForm.reset();
    } catch (e) {
      alert('Sorry, there was a problem sending your message. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  });
});
