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
      if (!res.ok) {
        let errText = 'Sorry, there was a problem sending your message. Please try again.';
        try {
          const data = await res.json();
          if (data && data.reason === 'EMAIL_NOT_CONFIGURED') errText = 'Email service is not configured on the server.';
          if (data && data.reason === 'FROM_NOT_VERIFIED') errText = 'Sender email is not verified with the email service.';
          if (data && data.reason === 'INVALID_API_KEY_OR_PERMISSIONS') errText = 'Email service credentials are invalid.';
        } catch {}
        throw new Error(errText);
      }
      alert('Thanks! Your message has been sent.');
      contactForm.reset();
    } catch (e) {
      alert(e.message || 'Sorry, there was a problem sending your message. Please try again.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = original; }
    }
  });
});
