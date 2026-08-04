// Base JavaScript for BMU CBT System
document.addEventListener('DOMContentLoaded', function() {
    // Initialize any admin interface functionality
    console.log('BMU CBT System loaded');
    
    // Auto-save functionality for forms
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('input', function() {
                // Mark form as dirty
                form.classList.add('form-dirty');
            });
        });
    });
    
    // Warning before leaving unsaved forms
    window.addEventListener('beforeunload', function(e) {
        const dirtyForms = document.querySelectorAll('.form-dirty');
        if (dirtyForms.length > 0) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
});
