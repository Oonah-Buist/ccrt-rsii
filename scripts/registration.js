// Registration form functionality
document.addEventListener('DOMContentLoaded', function() {
    const registrationForm = document.getElementById('registrationForm');
    
    if (registrationForm) {
        registrationForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(registrationForm);
            const firstName = formData.get('firstName');
            const lastName = formData.get('lastName');
            const dateOfBirth = formData.get('dateOfBirth');
            const email = formData.get('email');
            const phone = formData.get('phone');
            const invitationCode = formData.get('invitationCode');
            const privacyAgreement = formData.get('privacyAgreement');
            
            // Basic validation
            if (!privacyAgreement) {
                alert('Please agree to the Privacy Policy to continue.');
                return;
            }
            
            if (!invitationCode) {
                alert('Please enter your invitation code.');
                return;
            }
            
            // This would typically send data to a server for processing
            alert('Registration submitted successfully! You will receive a confirmation email shortly.');
            
            // Reset form
            registrationForm.reset();
        });
    }
});
