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
        const loginId = document.getElementById('participantId').value;
        const assignedForms = Array.from(document.querySelectorAll('.forms-checklist input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        if (!name || !loginId) {
            alert(`Please fill in all required fields. Name: '${name}', Login ID: '${loginId}'`);
            return;
        }
        // Debug: log what is being sent
        console.log('Saving participant:', { name, loginId, assignedForms });

        if (this.currentEditingParticipant && this.currentEditingParticipant.id) {
            // Edit existing participant
            const body = { name, loginId, assignedForms };
            const resp = await fetch(`/api/participants/${this.currentEditingParticipant.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });
            if (resp.ok) {
                this.hideParticipantForm();
                await this.loadParticipants();
            } else {
                alert('Failed to update participant');
            }
        } else {
            // Add participant
            const resp = await fetch('/api/participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name, loginId })
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
    }

    async saveForm() {
        const formName = document.getElementById('formName').value;
        const formDescription = document.getElementById('formDescription').value;
        if (!formName || !formDescription) {
            alert('Please fill in all required fields');
            return;
        }
        if (this.currentEditingForm && this.currentEditingForm.id) {
            // Edit existing form
            const resp = await fetch(`/api/forms/${this.currentEditingForm.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: formName, description: formDescription })
            });
            if (resp.ok) {
                this.hideFormForm();
                await this.loadForms();
            } else {
                alert('Failed to update form');
            }
        } else {
            // Add new form
            const resp = await fetch('/api/forms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ name: formName, description: formDescription })
            });
            if (resp.ok) {
                this.hideFormForm();
                await this.loadForms();
            } else {
                alert('Failed to add form');
            }
        }
    }

    showTab(tabName) {
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.style.display = 'none';
        });
        document.getElementById(tabName).style.display = 'block';

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
    }

    showParticipantForm(participant = null) {
        document.getElementById('participantForm').style.display = 'block';
        document.getElementById('participantFormElement').reset();
        this.renderFormsChecklist();
        if (participant) {
            document.getElementById('participantName').value = participant.name;
            document.getElementById('participantId').value = participant.loginId || participant.login_id || '';
            setTimeout(() => {
                const assignedForms = new Set((participant.assignedForms || []));
                document.querySelectorAll('.forms-checklist input[type="checkbox"]').forEach(cb => {
                    cb.checked = assignedForms.has(parseInt(cb.value));
                });
            }, 0);
            this.currentEditingParticipant = { id: participant.id, name: participant.name, loginId: participant.loginId || participant.login_id, assignedForms: participant.assignedForms };
            document.getElementById('addParticipantBtn').style.display = 'none';
        } else {
            this.currentEditingParticipant = null;
            document.getElementById('addParticipantBtn').style.display = 'none';
        }
    }

    hideParticipantForm() {
        document.getElementById('participantForm').style.display = 'none';
        document.getElementById('addParticipantBtn').style.display = 'block';
    }

    showFormForm() {
        document.getElementById('formForm').style.display = 'block';
        document.getElementById('formFormElement').reset();
        this.currentEditingForm = null;
    }

    hideFormForm() {
        document.getElementById('formForm').style.display = 'none';
        document.getElementById('addFormBtn').style.display = 'block';
    }

    renderParticipants() {
        const container = document.getElementById('participantsList');
        container.innerHTML = '';
        this.participants.forEach(participant => {
            const div = document.createElement('div');
            div.className = 'participant-entry';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <div>
                    <strong>${participant.name}</strong> (Login ID: <span class="participant-login-id">${participant.login_id}</span>)
                  </div>
                  <div class="item-actions">
                    <button class="edit-btn" data-id="${participant.id}">Edit</button>
                    <button class="delete-btn" data-id="${participant.id}">Delete</button>
                  </div>
                </div>
            `;
            container.appendChild(div);
        });
        // Re-apply event listeners after re-rendering
        this.reapplyParticipantEventListeners();
    }

    renderForms() {
        const container = document.getElementById('formsList');
        container.innerHTML = '';
        this.forms.forEach(form => {
            const div = document.createElement('div');
            div.className = 'form-entry';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <div>
                    <strong>${form.name}</strong>
                  </div>
                  <div class="item-actions">
                    <button class="edit-btn" data-id="${form.id}">Edit</button>
                    <button class="delete-btn" data-id="${form.id}">Delete</button>
                  </div>
                </div>
            `;
            container.appendChild(div);
        });
        // Re-apply event listeners after re-rendering
        this.reapplyFormEventListeners();
    }

    renderFormsChecklist() {
        const checklist = document.getElementById('formsChecklist');
        if (!checklist) return;
        if (!this.forms || this.forms.length === 0) {
            checklist.innerHTML = '<em>No forms available.</em>';
            return;
        }
        const checklistHTML = this.forms.map(form => `
            <div class="form-checkbox">
                <input type="checkbox" id="form-${form.id}" value="${form.id}">
                <label for="form-${form.id}">${form.name}</label>
            </div>
        `).join('');
        checklist.innerHTML = checklistHTML;
    }

    reapplyParticipantEventListeners() {
        document.querySelectorAll('.participant-entry .edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const participantId = e.target.dataset.id;
                this.editParticipant(participantId);
            });
        });
        document.querySelectorAll('.participant-entry .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const participantId = e.target.dataset.id;
                this.deleteParticipant(participantId);
            });
        });
    }

    reapplyFormEventListeners() {
        document.querySelectorAll('.form-entry .edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const formId = e.target.dataset.id;
                this.editForm(formId);
            });
        });
        document.querySelectorAll('.form-entry .delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const formId = e.target.dataset.id;
                this.deleteForm(formId);
            });
        });
    }

    async editParticipant(participantId) {
        // Fetch participant details and assigned forms from backend
        const resp = await fetch(`/api/participants/${participantId}`, { credentials: 'include' });
        if (resp.ok) {
            const data = await resp.json();
            this.showParticipantForm({
                id: data.id,
                name: data.name,
                login_id: data.login_id, // Pass login_id to form
                assignedForms: data.assignedForms
            });
        } else {
            alert('Failed to load participant info');
        }
    }

    async deleteParticipant(participantId) {
        if (confirm('Are you sure you want to delete this participant?')) {
            const resp = await fetch(`/api/participants/${participantId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (resp.ok) {
                await this.loadParticipants();
            } else {
                alert('Failed to delete participant');
            }
        }
    }

    async editForm(formId) {
        const form = this.forms.find(f => f.id === parseInt(formId));
        if (form) {
            document.getElementById('formName').value = form.name;
            document.getElementById('formDescription').value = form.description;
            this.currentEditingForm = form;
            document.getElementById('formForm').style.display = 'block';
            document.getElementById('addFormBtn').style.display = 'none';
        }
    }

    async deleteForm(formId) {
        if (confirm('Are you sure you want to delete this form?')) {
            const resp = await fetch(`/api/forms/${formId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            if (resp.ok) {
                await this.loadForms();
            } else {
                alert('Failed to delete form');
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminConsole();
});
