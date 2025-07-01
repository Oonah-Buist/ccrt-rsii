// Contact form functionality
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const name = formData.get('name');
            const email = formData.get('email');
            const phone = formData.get('phone');
            const subject = formData.get('subject');
            const message = formData.get('message');
            
            // Create email body
            const emailBody = `Name: ${name}%0D%0A` +
                             `Email: ${email}%0D%0A` +
                             `Phone: ${phone || 'Not provided'}%0D%0A%0D%0A` +
                             `Message:%0D%0A${message}`;
            
            // Create mailto link
            const mailtoLink = `mailto:contact@ccrt-rsii.org?subject=${encodeURIComponent(subject)}&body=${emailBody}`;
            
            // Open email client
            window.location.href = mailtoLink;
        });
    }
});
