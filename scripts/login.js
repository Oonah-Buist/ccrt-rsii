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
            
            // Load participants from localStorage
            const participants = JSON.parse(localStorage.getItem('participants') || '[]');
            const participant = participants.find(p => p.password === password);
            
            if (participant) {
                // Store current participant in localStorage
                localStorage.setItem('currentParticipant', JSON.stringify(participant));
                // Redirect to participant portal
                window.location.href = 'participant-portal.html';
            } else {
                alert('Invalid password. Please try again.');
                document.getElementById('participantPassword').value = '';
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
