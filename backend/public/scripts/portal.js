// Portal JavaScript
class ParticipantPortal {
    constructor() {
        this.forms = [];
        this.participant = null;
        this.init();
    }

    async init() {
        await this.loadParticipant();
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
        // Listen for Thank You redirect page notifying completion
        window.addEventListener('message', (event) => {
            try {
                const data = event.data || {};
                if (data.type === 'form_completed') {
                    // Refresh forms when notified
                    this.loadFormsFromBackend();
                }
            } catch (e) {}
        });
    }

    async loadParticipant() {
        try {
            const resp = await fetch('/api/participant/me', { credentials: 'include' });
            if (resp.status === 401) { this.redirectToLogin(); return; }
            if (!resp.ok) throw new Error('Failed to load participant');
            const data = await resp.json();
            this.participant = data.participant;
        } catch (err) {
            this.participant = null;
        }
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

    // Normalize relative image paths like "assets/buttons/Button 1.jpg" to "/assets/buttons/Button 1.jpg"
    normalizeImagePath(p) {
        if (!p) return '/assets/buttons/Button 1.jpg';
        const cleaned = String(p).trim();
        if (/^https?:\/\//i.test(cleaned)) return cleaned; // external URLs
        const noLeading = cleaned.replace(/^\.?\//, '');
        return '/' + noLeading;
    }

    // Derive a direct JotForm URL from an embed snippet or URL
    deriveJotformUrl(embed) {
        if (!embed) return null;
        const s = String(embed);
        // If it's already a direct link
        const direct = s.match(/https?:\/\/form\.jotform\.com\/(\d+)/i);
        if (direct) return `https://form.jotform.com/${direct[1]}`;
        // jsform script embed
        const jsformId = s.match(/jsform\/(\d+)/i);
        if (jsformId) return `https://form.jotform.com/${jsformId[1]}`;
        // iframe src
        const src = s.match(/src="([^"]+)"/i);
        if (src && /jotform\.com/i.test(src[1])) {
            // If it's a jsform URL, convert to direct form URL
            const idFromSrc = src[1].match(/(?:jsform|\/)(\d+)/i);
            if (idFromSrc) return `https://form.jotform.com/${idFromSrc[1]}`;
            return src[1];
        }
        return null;
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
            const imageSrc = this.normalizeImagePath(form.button_image);
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

    buildPrefillParams(form) {
        const params = new URLSearchParams();
        // Backend-friendly params (for potential Thank You URL placeholders / debugging)
        if (this.participant && this.participant.id) params.set('participant_id', this.participant.id);
        if (form && form.id) params.set('form_id', form.id);
        if (this.participant && this.participant.login_id) params.set('login_id', this.participant.login_id);
        // JotForm Unique Names used in your forms
        if (this.participant && this.participant.login_id) params.set('participantLoginID', this.participant.login_id);
        if (form && form.id) params.set('appFormID', form.id);
        return params.toString();
    }

    async openForm(formId) {
        const form = this.forms.find(f => f.id == formId);
        if (!form || form.completed) return;
        // Derive direct JotForm URL and append prefill params
        const baseUrl = this.deriveJotformUrl(form.jotform_embed);
        if (!baseUrl) {
            alert('Unable to open form: invalid JotForm embed. Please contact support.');
            return;
        }
        const query = this.buildPrefillParams(form);
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + query;
        window.open(url, '_blank');
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
