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
            const login_id = document.getElementById('participantLoginId').value;
            // Use backend API for login
            const resp = await fetch('/api/participant/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ login_id })
            });
            if (resp.ok) {
                window.location.href = 'participant-portal';
            } else {
                alert('Invalid Login ID. Please try again.');
                document.getElementById('participantLoginId').value = '';
            }
        });
    }
    
    // BAA Login Form
    const baaLoginForm = document.getElementById('baaLoginForm');
    if (baaLoginForm) {
        baaLoginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const login_id = document.getElementById('baaLoginId').value;
            try {
                const resp = await fetch('/api/baa/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ login_id })
                });
                if (resp.ok) {
                    window.location.href = 'baa-form';
                } else if (resp.status === 401) {
                    alert('Invalid Login ID. Please try again.');
                    document.getElementById('baaLoginId').value = '';
                } else {
                    alert('Login failed. Please try again later.');
                }
            } catch (err) {
                console.error('BAA login error:', err);
                alert('Network error. Please try again.');
            }
        });
    }
});
