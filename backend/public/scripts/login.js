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
        participantLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const password = document.getElementById('participantPassword').value;
            // Use backend API for login
            const resp = await fetch('/api/participant/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: '', password }) // name is blank for now, update if you use usernames
            });
            if (resp.ok) {
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
