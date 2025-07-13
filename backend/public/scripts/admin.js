// Admin Console JavaScript
class AdminConsole {
    constructor() {
        this.participants = [];
        this.forms = [];
        this.init();
    }

    async init() {
        await this.loadParticipants();
        await this.loadForms();
        this.setupEventListeners();
        this.showTab('participants');
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.showTab(e.target.dataset.tab);
            });
        });

        // Add participant
        document.getElementById('addParticipantBtn').addEventListener('click', () => {
            // Hide the add participant button
            document.getElementById('addParticipantBtn').style.display = 'none';
            this.showParticipantForm();
        });

        // Cancel participant form
        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideParticipantForm();
        });

        // Submit participant form
        document.getElementById('participantFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveParticipant();
        });

        // Add form
        document.getElementById('addFormBtn').addEventListener('click', () => {
            this.showFormForm();
        });

        // Cancel form form
        document.getElementById('cancelFormBtn').addEventListener('click', () => {
            this.hideFormForm();
        });

        // Submit form form
        document.getElementById('formFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveForm();
        });

        // BAA Tab logic
        const addBaaBtn = document.getElementById('addBaaBtn');
        const baaForm = document.getElementById('baaForm');
        const baaFormElement = document.getElementById('baaFormElement');
        const cancelBaaBtn = document.getElementById('cancelBaaBtn');
        const baaList = document.getElementById('baaList');

        async function fetchBaas() {
            baaList.innerHTML = '<div>Loading...</div>';
            try {
                const res = await fetch('/api/baas', { credentials: 'include' });
                if (!res.ok) throw new Error('Failed to fetch BAAs');
                const data = await res.json();
                baaList.innerHTML = '';
                if (data.baas.length === 0) {
                    baaList.innerHTML = '<div>No Business Associates found.</div>';
                } else {
                    data.baas.forEach(baa => {
                        const entry = document.createElement('div');
                        entry.className = 'baa-entry';
                        entry.innerHTML = `<strong>BAA #${baa.id}</strong><br><em>JotForm:</em> <code>${baa.jotform_embed ? baa.jotform_embed.replace(/</g, '&lt;') : ''}</code>`;
                        // Add update form for each BAA
                        const updateForm = document.createElement('form');
                        updateForm.innerHTML = `
                            <input type="password" placeholder="New Password" name="password" style="margin-right:8px;">
                            <input type="text" placeholder="New JotForm Embed" name="jotform_embed" style="width:300px; margin-right:8px;">
                            <button type="submit">Update</button>
                        `;
                        updateForm.onsubmit = async (e) => {
                            e.preventDefault();
                            const formData = new FormData(updateForm);
                            const body = {};
                            if (formData.get('password')) body.password = formData.get('password');
                            if (formData.get('jotform_embed')) body.jotform_embed = formData.get('jotform_embed');
                            if (!body.password && !body.jotform_embed) return;
                            const resp = await fetch(`/api/baas/${baa.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify(body)
                            });
                            if (resp.ok) {
                                fetchBaas();
                            } else {
                                alert('Failed to update BAA');
                            }
                        };
                        entry.appendChild(updateForm);
                        baaList.appendChild(entry);
                    });
                }
            } catch (err) {
                baaList.innerHTML = `<div style="color:red;">${err.message}</div>`;
            }
        }

        if (addBaaBtn) {
            addBaaBtn.addEventListener('click', () => {
                baaForm.style.display = 'block';
                addBaaBtn.style.display = 'none';
            });
        }
        if (cancelBaaBtn) {
            cancelBaaBtn.addEventListener('click', () => {
                baaForm.style.display = 'none';
                addBaaBtn.style.display = 'block';
                baaFormElement.reset();
            });
        }
        if (baaFormElement) {
            baaFormElement.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = document.getElementById('baaPassword').value;
                const jotform = document.getElementById('baaJotform').value;
                // Add BAA via backend
                const resp = await fetch('/api/baas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ password, jotform_embed: jotform })
                });
                if (resp.ok) {
                    baaForm.style.display = 'none';
                    addBaaBtn.style.display = 'block';
                    baaFormElement.reset();
                    fetchBaas();
                } else {
                    alert('Failed to add BAA');
                }
            });
        }
        // Load BAAs on tab open
        const baaTabBtn = document.querySelector('.tab-btn[data-tab="baa"]');
        if (baaTabBtn) {
            baaTabBtn.addEventListener('click', fetchBaas);
        }
        // Optionally, load on page load if BAA tab is default
        if (document.getElementById('baa').classList.contains('active')) {
            fetchBaas();
        }
    }

    async loadParticipants() {
        const resp = await fetch('/api/participants', { credentials: 'include' });
        if (resp.ok) {
            const data = await resp.json();
            this.participants = data.participants;
        } else {
            this.participants = [];
        }
        this.renderParticipants();
    }

    async loadForms() {
        const resp = await fetch('/api/forms', { credentials: 'include' });
        if (resp.ok) {
            const data = await resp.json();
            this.forms = data.forms;
        } else {
            this.forms = [];
        }
        this.renderForms();
    }

    async saveParticipant() {
        const name = document.getElementById('participantName').value;
        const password = document.getElementById('participantPassword').value;
        const assignedForms = Array.from(document.querySelectorAll('.forms-checklist input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        if (!name || !password) {
            alert('Please fill in all required fields');
            return;
        }
        // Add participant
        const resp = await fetch('/api/participants', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, password })
        });
        if (resp.ok) {
            const data = await resp.json();
            // Assign forms
            if (assignedForms.length > 0) {
                await fetch('/api/assign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ participant_id: data.id, form_ids: assignedForms })
                });
            }
            this.hideParticipantForm();
            await this.loadParticipants();
        } else {
            alert('Failed to add participant');
        }
    }

    showTab(tabName) {
        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    }

    showParticipantForm(participant = null) {
        this.currentEditingParticipant = participant;
        const form = document.getElementById('participantForm');
        
        // First render the forms checklist
        this.renderFormsChecklist();
        
        if (participant) {
            document.getElementById('participantName').value = participant.name;
            document.getElementById('participantPassword').value = participant.password;
            
            // Set assigned forms checkboxes after rendering the checklist
            setTimeout(() => {
                const checkboxes = document.querySelectorAll('.forms-checklist input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = participant.assignedForms && participant.assignedForms.includes(checkbox.value);
                });
            }, 10);
        } else {
            document.getElementById('participantFormElement').reset();
        }

        form.style.display = 'block';
    }

    hideParticipantForm() {
        document.getElementById('participantForm').style.display = 'none';
        this.currentEditingParticipant = null;
        
        // Show the add participant button again
        document.getElementById('addParticipantBtn').style.display = 'block';
    }

    renderFormsChecklist() {
        const checklist = document.getElementById('formsChecklist');
        const checklistHTML = this.forms.map(form => `
            <div class="form-checkbox">
                <input type="checkbox" id="form-${form.id}" value="${form.id}">
                <label for="form-${form.id}">${form.name}</label>
            </div>
        `).join('');
        checklist.innerHTML = checklistHTML;
    }

    renderParticipants() {
        const list = document.getElementById('participantsList');
        if (this.participants.length === 0) {
            list.innerHTML = '<p>No participants yet. Click "Add New Participant" to get started.</p>';
            return;
        }

        const participantsHTML = this.participants.map(participant => `
            <div class="participant-item">
                <div class="participant-info-item">
                    <div class="participant-name">${participant.name}</div>
                </div>
            </div>
        `).join('');

        list.innerHTML = participantsHTML;
    }

    async saveForm() {
        const name = document.getElementById('formName').value;
        const jotform_embed = document.getElementById('formScript').value;
        if (!name || !jotform_embed) {
            alert('Please fill in all required fields');
            return;
        }
        const resp = await fetch('/api/forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, jotform_embed })
        });
        if (resp.ok) {
            this.hideFormForm();
            await this.loadForms();
        } else {
            alert('Failed to add form');
        }
    }

    renderForms() {
        const list = document.getElementById('formsList');
        if (this.forms.length === 0) {
            list.innerHTML = '<p>No forms available.</p>';
            return;
        }

        const formsHTML = this.forms.map(form => `
            <div class="form-item">
                <div class="form-info-item">
                    <div class="form-name">${form.name}</div>
                </div>
            </div>
        `).join('');

        list.innerHTML = formsHTML;
    }

    renderSubmissions() {
        const list = document.getElementById('submissionsList');
        if (this.submissions.length === 0) {
            list.innerHTML = '<p>No form submissions yet.</p>';
            return;
        }

        // Group submissions by participant
        const groupedSubmissions = this.submissions.reduce((acc, submission) => {
            const participant = this.participants.find(p => p.id === submission.participantId);
            const participantName = participant ? participant.name : 'Unknown Participant';
            
            if (!acc[participantName]) {
                acc[participantName] = [];
            }
            acc[participantName].push(submission);
            return acc;
        }, {});

        const submissionsHTML = Object.entries(groupedSubmissions).map(([participantName, submissions]) => `
            <div class="submission-item">
                <div class="submission-header">
                    <div class="submission-participant">${participantName}</div>
                    <div class="submission-date">Last submission: ${new Date(submissions[submissions.length - 1].submittedAt).toLocaleDateString()}</div>
                </div>
                <div class="submission-forms">
                    ${submissions.map(sub => {
                        const form = this.forms.find(f => f.id === sub.formId);
                        return `<div class="submission-form">${form ? form.name : sub.formId}</div>`;
                    }).join('')}
                </div>
            </div>
        `).join('');

        list.innerHTML = submissionsHTML;
    }

    renderAll() {
        this.renderParticipants();
        this.renderForms();
        this.renderSubmissions();
    }
}

// Initialize admin console when page loads
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminConsole();
});

// Make admin globally available
window.admin = admin;
