// Portal JavaScript
class ParticipantPortal {
    constructor() {
        this.currentParticipant = null;
        this.forms = [];
        this.submissions = [];
        this.init();
    }

    init() {
        this.loadParticipantData();
        this.setupEventListeners();
    }

    setupEventListeners() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        
        // Refresh forms when window gains focus (user returns from form)
        window.addEventListener('focus', () => {
            this.loadSubmissions();
            this.renderForms();
        });
    }

    loadParticipantData() {
        // Get participant data from localStorage (set during login)
        const participantData = localStorage.getItem('currentParticipant');
        if (!participantData) {
            this.redirectToLogin();
            return;
        }

        try {
            this.currentParticipant = JSON.parse(participantData);
            this.loadForms();
            this.loadSubmissions();
            this.renderForms();
        } catch (error) {
            console.error('Error loading participant data:', error);
            this.redirectToLogin();
        }
    }

    loadForms() {
        // Always load the latest forms (force update)
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
                id: 'medical-history-5-f',
                name: 'Medical History 5 (F)',
                script: 'https://form.jotform.com/jsform/240980062647358',
                button: 'Button photos/Button 11.jpg'
            },
            {
                id: 'medical-history-5-m',
                name: 'Medical History 5 (M)',
                script: 'https://form.jotform.com/jsform/240980848706366',
                button: 'Button photos/Button 12.jpg'
            }
        ];
        localStorage.setItem('portalForms', JSON.stringify(this.forms));
    }

    loadSubmissions() {
        // Load submissions from localStorage
        const savedSubmissions = localStorage.getItem('formSubmissions');
        if (savedSubmissions) {
            this.submissions = JSON.parse(savedSubmissions);
        } else {
            this.submissions = [];
        }
    }

    renderForms() {
        const formsGrid = document.getElementById('formsGrid');
        if (!formsGrid) return;

        // Get participant's assigned forms
        const assignedForms = this.currentParticipant.assignedForms || [];
        
        if (assignedForms.length === 0) {
            formsGrid.innerHTML = '<p class="no-forms">No forms assigned yet. Please contact your administrator.</p>';
            return;
        }

        const formsHTML = assignedForms.map(formId => {
            const form = this.forms.find(f => f.id === formId);
            if (!form) return '';

            const isSubmitted = this.isFormSubmitted(formId);
            const cardClass = isSubmitted ? 'form-card completed' : 'form-card';
            const clickHandler = isSubmitted ? '' : `portal.openForm('${formId}')`;
            const pointerEvents = isSubmitted ? 'pointer-events: none;' : '';
            
            // Get submission details if form is completed
            let statusText = 'Ready to complete';
            if (isSubmitted) {
                const submission = this.submissions.find(sub => 
                    sub.participantId === this.currentParticipant.id && 
                    sub.formId === formId
                );
                if (submission) {
                    const submissionDate = new Date(submission.submittedAt);
                    statusText = `Submitted on ${submissionDate.toLocaleDateString()} at ${submissionDate.toLocaleTimeString()}`;
                } else {
                    statusText = 'Form has been submitted';
                }
            }
            
            return `
                <div class="${cardClass}">
                    <div class="form-card-content">
                        <div class="form-image-container" ${clickHandler ? `onclick="${clickHandler}"` : ''} style="${pointerEvents}">
                            <img src="${form.button}" alt="${form.name}" class="form-image">
                            <div class="form-overlay-text">${isSubmitted ? 'Completed ✓' : 'Click to Complete'}</div>
                        </div>
                        <h3 class="form-title">${form.name}</h3>
                        <p class="form-status">${statusText}</p>
                    </div>
                </div>
            `;
        }).join('');

        formsGrid.innerHTML = formsHTML;
    }

    isFormSubmitted(formId) {
        return this.submissions.some(sub => 
            sub.participantId === this.currentParticipant.id && 
            sub.formId === formId
        );
    }

    openForm(formId) {
        // Check if form is already submitted
        if (this.isFormSubmitted(formId)) {
            alert('This form has already been completed and cannot be filled out again.');
            return;
        }

        const form = this.forms.find(f => f.id === formId);
        if (!form) return;

        // Create a new page for the form
        const formWindow = window.open('', '_blank');
        formWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${form.name} - CCRT RSII</title>
                <link rel="stylesheet" href="styles/main.css">
                <style>
                    body { margin: 0; padding: 20px; }
                    .form-container { max-width: 800px; margin: 0 auto; }
                    .form-header { text-align: center; margin-bottom: 2rem; }
                    .back-btn { 
                        background: var(--purple); 
                        color: white; 
                        border: none; 
                        padding: 0.75rem 2rem; 
                        border-radius: 6px; 
                        cursor: pointer; 
                        margin-bottom: 2rem;
                    }
                </style>
            </head>
            <body>
                <div class="form-container">
                    <div class="form-header">
                        <button class="back-btn" onclick="window.close()">← Back to Portal</button>
                        <h1>${form.name}</h1>
                    </div>
                    <script type="text/javascript" src="${form.script}"></script>
                    <script>
                        // Function to mark form as submitted
                        function markFormAsSubmitted() {
                            const submission = {
                                participantId: '${this.currentParticipant.id}',
                                formId: '${formId}',
                                submittedAt: new Date().toISOString()
                            };
                            
                            const submissions = JSON.parse(localStorage.getItem('formSubmissions') || '[]');
                            submissions.push(submission);
                            localStorage.setItem('formSubmissions', JSON.stringify(submissions));
                            
                            alert('Form submitted successfully! The form has been marked as complete.');
                            window.close();
                        }
                        
                        // Listen for JotForm submission events
                        window.addEventListener('message', function(event) {
                            if (event.data.type === 'form_submission' || 
                                event.data.type === 'form_submit' ||
                                (event.data && event.data.includes && event.data.includes('submit'))) {
                                markFormAsSubmitted();
                            }
                        });
                        
                        // Check if form gets submitted by monitoring for success messages
                        let checkCount = 0;
                        const checkForSubmission = setInterval(() => {
                            checkCount++;
                            
                            // Check for success messages or redirect indicators
                            const successElements = document.querySelectorAll('[class*="success"], [class*="thank"], [id*="success"], [id*="thank"], .form-thank-you, .jotform-success');
                            const thankYouText = document.body.textContent.toLowerCase();
                            
                            if (successElements.length > 0 || 
                                thankYouText.includes('thank you') || 
                                thankYouText.includes('submitted') ||
                                thankYouText.includes('success') ||
                                thankYouText.includes('form has been submitted')) {
                                clearInterval(checkForSubmission);
                                markFormAsSubmitted();
                            }
                            
                            // Stop checking after 5 minutes
                            if (checkCount > 300) {
                                clearInterval(checkForSubmission);
                            }
                        }, 1000);
                        
                        // Add a manual "Mark as Complete" button for fallback
                        setTimeout(() => {
                            const header = document.querySelector('.form-header');
                            if (header) {
                                const completeBtn = document.createElement('button');
                                completeBtn.textContent = 'Mark as Complete';
                                completeBtn.className = 'back-btn';
                                completeBtn.style.backgroundColor = '#28a745';
                                completeBtn.style.marginLeft = '1rem';
                                completeBtn.onclick = function() {
                                    if (confirm('Are you sure you want to mark this form as complete?')) {
                                        markFormAsSubmitted();
                                    }
                                };
                                header.appendChild(completeBtn);
                            }
                        }, 2000);
                    </script>
                </div>
            </body>
            </html>
        `);
        formWindow.document.close();
    }

    logout() {
        localStorage.removeItem('currentParticipant');
        this.redirectToLogin();
    }

    redirectToLogin() {
        window.location.href = 'participant-login.html';
    }

    // Test method to manually mark a form as complete (for testing purposes)
    markFormComplete(formId) {
        const submission = {
            participantId: this.currentParticipant.id,
            formId: formId,
            submittedAt: new Date().toISOString()
        };
        
        const submissions = JSON.parse(localStorage.getItem('formSubmissions') || '[]');
        submissions.push(submission);
        localStorage.setItem('formSubmissions', JSON.stringify(submissions));
        
        // Refresh the display
        this.loadSubmissions();
        this.renderForms();
        
        console.log('Form marked as complete:', formId);
    }

    // Test method to clear all submissions (for testing purposes)
    clearAllSubmissions() {
        localStorage.removeItem('formSubmissions');
        this.loadSubmissions();
        this.renderForms();
        console.log('All submissions cleared');
    }
}

// Initialize portal when page loads
let portal;
document.addEventListener('DOMContentLoaded', () => {
    portal = new ParticipantPortal();
});

// Make portal globally available
window.portal = portal;
