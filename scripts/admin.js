// Admin Console JavaScript
class AdminConsole {
    constructor() {
        this.participants = [];
        this.forms = [];
        this.submissions = [];
        this.currentEditingParticipant = null;
        this.init();
    }

    init() {
        this.loadData();
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
    }

    loadData() {
        // Load participants
        const savedParticipants = localStorage.getItem('participants');
        if (savedParticipants) {
            this.participants = JSON.parse(savedParticipants);
        }

        // Load forms
        const savedForms = localStorage.getItem('portalForms');
        if (savedForms) {
            this.forms = JSON.parse(savedForms);
        } else {
            // Initialize with default forms
            this.forms = [
                {
                    id: 'participant-registration',
                    name: 'Participant Registration Form',
                    script: 'https://form.jotform.com/jsform/240416281252347',
                    button: 'Button photos/Button 1.jpg'
                },
                {
                    id: 'approved-participant',
                    name: 'Approved Participant Registration Form',
                    script: 'https://form.jotform.com/jsform/240460766257359',
                    button: 'Button photos/Button 2.jpg'
                },
                {
                    id: 'non-disclosure',
                    name: 'Non Disclosure Agreement',
                    script: 'https://form.jotform.com/jsform/240420220855344',
                    button: 'Button photos/Button 3.jpg'
                },
                {
                    id: 'confidentiality-exceptions',
                    name: 'Confidentiality Exceptions and Exemptions',
                    script: 'https://form.jotform.com/jsform/240530846219354',
                    button: 'Button photos/Button 4.jpg'
                },
                {
                    id: 'spousal-confidentiality',
                    name: 'Spousal Confidentiality Agreement',
                    script: 'https://form.jotform.com/jsform/240532319527353',
                    button: 'Button photos/Button 5.jpg'
                },
                {
                    id: 'medical-history-1-f',
                    name: 'Medical History 1 (F)',
                    script: 'https://form.jotform.com/jsform/240978903718368',
                    button: 'Button photos/Button 6.jpg'
                },
                {
                    id: 'medical-history-1-m',
                    name: 'Medical History 1 (M)',
                    script: 'https://form.jotform.com/jsform/240979364404362',
                    button: 'Button photos/Button 7.jpg'
                },
                {
                    id: 'medical-history-2',
                    name: 'Medical History 2',
                    script: 'https://form.jotform.com/jsform/240978994174374',
                    button: 'Button photos/Button 8.jpg'
                },
                {
                    id: 'medical-history-3',
                    name: 'Medical History 3',
                    script: 'https://form.jotform.com/jsform/240978683543369',
                    button: 'Button photos/Button 9.jpg'
                },
                {
                    id: 'medical-history-4',
                    name: 'Medical History 4',
                    script: 'https://form.jotform.com/jsform/240980887791373',
                    button: 'Button photos/Button 10.jpg'
                },
                {
                    id: 'medical-history-5',
                    name: 'Medical History 5',
                    script: 'https://form.jotform.com/jsform/240980062647358',
                    button: 'Button photos/Button 11.jpg'
                }
            ];
            localStorage.setItem('portalForms', JSON.stringify(this.forms));
        }

        // Load submissions
        const savedSubmissions = localStorage.getItem('formSubmissions');
        if (savedSubmissions) {
            this.submissions = JSON.parse(savedSubmissions);
        }

        this.renderAll();
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

    saveParticipant() {
        const name = document.getElementById('participantName').value;
        const password = document.getElementById('participantPassword').value;
        const assignedForms = Array.from(document.querySelectorAll('.forms-checklist input[type="checkbox"]:checked'))
            .map(checkbox => checkbox.value);

        if (!name || !password) {
            alert('Please fill in all required fields');
            return;
        }

        const participant = {
            id: this.currentEditingParticipant ? this.currentEditingParticipant.id : Date.now().toString(),
            name,
            password,
            assignedForms,
            createdAt: this.currentEditingParticipant ? this.currentEditingParticipant.createdAt : new Date().toISOString()
        };

        if (this.currentEditingParticipant) {
            // Update existing participant
            const index = this.participants.findIndex(p => p.id === this.currentEditingParticipant.id);
            this.participants[index] = participant;
        } else {
            // Add new participant
            this.participants.push(participant);
        }

        localStorage.setItem('participants', JSON.stringify(this.participants));
        this.hideParticipantForm();
        this.renderParticipants();
    }

    editParticipant(participantId) {
        const participant = this.participants.find(p => p.id === participantId);
        if (participant) {
            this.showParticipantForm(participant);
        }
    }

    deleteParticipant(participantId) {
        if (confirm('Are you sure you want to delete this participant?')) {
            this.participants = this.participants.filter(p => p.id !== participantId);
            localStorage.setItem('participants', JSON.stringify(this.participants));
            this.renderParticipants();
        }
    }

    showFormForm() {
        document.getElementById('formForm').style.display = 'block';
    }

    hideFormForm() {
        document.getElementById('formForm').style.display = 'none';
    }

    saveForm() {
        const name = document.getElementById('formName').value;
        const script = document.getElementById('formScript').value;
        const button = document.getElementById('formButton').value;

        if (!name || !script || !button) {
            alert('Please fill in all required fields');
            return;
        }

        const form = {
            id: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name,
            script,
            button
        };

        this.forms.push(form);
        localStorage.setItem('portalForms', JSON.stringify(this.forms));
        this.hideFormForm();
        this.renderForms();
    }

    deleteForm(formId) {
        if (confirm('Are you sure you want to delete this form?')) {
            this.forms = this.forms.filter(f => f.id !== formId);
            localStorage.setItem('portalForms', JSON.stringify(this.forms));
            this.renderForms();
        }
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
                    <div class="participant-forms">
                        Password: ${participant.password}<br>
                        Assigned Forms: ${participant.assignedForms.length} forms
                    </div>
                </div>
                <div class="item-actions">
                    <button class="edit-btn" onclick="admin.editParticipant('${participant.id}')">Edit</button>
                    <button class="delete-btn" onclick="admin.deleteParticipant('${participant.id}')">Delete</button>
                </div>
            </div>
        `).join('');

        list.innerHTML = participantsHTML;
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
                    <div class="form-script">Script: ${form.script}</div>
                    <div class="form-script">Button: ${form.button}</div>
                </div>
                <div class="item-actions">
                    <button class="delete-btn" onclick="admin.deleteForm('${form.id}')">Delete</button>
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
