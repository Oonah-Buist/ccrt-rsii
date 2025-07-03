// Login functionality and password toggle
function togglePassword(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.nextElementSibling;
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = '🙈';
    } else {
        passwordInput.type = 'password';
        toggleButton.textContent = '👁️';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Participant Login Form
    const participantLoginForm = document.getElementById('participantLoginForm');
    if (participantLoginForm) {
        participantLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const password = document.getElementById('participantPassword').value;
            
            // This is a placeholder - you would implement actual authentication
            if (password) {
                alert('Login functionality would be implemented here with proper backend authentication.');
                // Redirect to participant dashboard or protected area
                // window.location.href = 'participant-dashboard.html';
            }
        });
    }
    
    // BAA Login Form
    const baaLoginForm = document.getElementById('baaLoginForm');
    if (baaLoginForm) {
        baaLoginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const password = document.getElementById('baaPassword').value;
            
            // Check for fixed password
            if (password === '12345678') {
                // Redirect to BAA form page
                window.location.href = 'baa-form.html';
            } else {
                alert('Invalid password. Please try again.');
                document.getElementById('baaPassword').value = '';
            }
        });
    }
});
