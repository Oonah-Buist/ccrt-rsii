// Portal JavaScript
class ParticipantPortal {
    constructor() {
        this.forms = [];
        this.init();
    }

    async init() {
        await this.loadFormsFromBackend();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        window.addEventListener('focus', () => {
            this.loadFormsFromBackend();
        });
    }

    async loadFormsFromBackend() {
        try {
            const resp = await fetch('/api/participant/forms', { credentials: 'include' });
            if (resp.status === 401) {
                this.redirectToLogin();
                return;
            }
            const data = await resp.json();
            this.forms = data.forms;
            this.renderForms();
        } catch (err) {
            this.forms = [];
            this.renderForms();
        }
    }

    renderForms() {
        const formsGrid = document.getElementById('formsGrid');
        if (!formsGrid) return;
        if (!this.forms || this.forms.length === 0) {
            formsGrid.innerHTML = '<p class="no-forms">No forms assigned yet. Please contact your administrator.</p>';
            return;
        }
        const formsHTML = this.forms.map(form => {
            const isSubmitted = form.completed;
            const cardClass = isSubmitted ? 'form-card completed' : 'form-card';
            const clickHandler = isSubmitted ? '' : `portal.openForm(${form.id})`;
            const pointerEvents = isSubmitted ? 'pointer-events: none;' : '';
            let statusText = isSubmitted ? 'COMPLETED' : 'CLICK TO COMPLETE';
            // Use the button_image field from the backend, fallback to default if missing
            const imageSrc = form.button_image ? form.button_image : 'assets/buttons/Button 1.jpg';
            return `
                <div class="${cardClass}">
                    <div class="form-card-content">
                        <div class="form-image-container" ${clickHandler ? `onclick=\"${clickHandler}\"` : ''} style="${pointerEvents}">
                            <img src="${imageSrc}" alt="Form" class="form-image">
                            <div class="form-overlay-text">${statusText}</div>
                        </div>
                        <h3 class="form-title">${form.name}</h3>
                    </div>
                </div>
            `;
        }).join('');
        formsGrid.innerHTML = formsHTML;
    }

    async openForm(formId) {
        const form = this.forms.find(f => f.id == formId);
        if (!form || form.completed) return;
        // Open JotForm in new window
        const formWindow = window.open('', '_blank');
        formWindow.document.write(`
            <!DOCTYPE html>
            <html lang=\"en\">
            <head>
                <meta charset=\"UTF-8\">
                <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">
                <title>${form.name} - CCRT RSII</title>
                <link rel=\"stylesheet\" href=\"styles/main.css\">
                <style>body { margin: 0; padding: 20px; } .form-container { max-width: 800px; margin: 0 auto; } .form-header { text-align: center; margin-bottom: 2rem; } .back-btn { background: var(--purple); color: white; border: none; padding: 0.75rem 2rem; border-radius: 6px; cursor: pointer; margin-bottom: 2rem; }</style>
            </head>
            <body>
                <div class=\"form-container\">
                    <div class=\"form-header\">
                        <button class=\"back-btn\" onclick=\"window.close()\">← Back to Portal</button>
                        <h1>${form.name}</h1>
                    </div>
                    ${form.jotform_embed}
                    <script>
                        let hasBeenSubmitted = false;
                        function markFormAsSubmitted() {
                            if (hasBeenSubmitted) return;
                            hasBeenSubmitted = true;
                            fetch('/api/participant/complete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({ form_id: ${form.id} })
                            }).then(() => {
                                alert('Form submitted successfully! The form has been marked as complete.');
                                window.close();
                            });
                        }
                        window.addEventListener('message', function(event) {
                            if (event.data.type === 'form_submission' || event.data.type === 'form_submit' || (event.data && event.data.includes && event.data.includes('submit'))) {
                                markFormAsSubmitted();
                            }
                        });
                        setTimeout(() => {
                            const checkForSubmission = setInterval(() => {
                                const thankYouText = document.body.textContent.toLowerCase();
                                if (thankYouText.includes('thank you for your submission') || thankYouText.includes('form has been submitted') || thankYouText.includes('submission received')) {
                                    clearInterval(checkForSubmission);
                                    markFormAsSubmitted();
                                }
                            }, 1000);
                        }, 5000);
                    <\/script>
                </div>
            </body>
            </html>
        `);
        formWindow.document.close();
    }

    async logout() {
        await fetch('/api/participant/logout', { method: 'POST', credentials: 'include' });
        this.redirectToLogin();
    }

    redirectToLogin() {
        window.location.href = 'participant-login.html';
    }
}

let portal;
document.addEventListener('DOMContentLoaded', () => {
    portal = new ParticipantPortal();
});
window.portal = portal;
