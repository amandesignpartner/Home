// Quick Pick Up JavaScript Functionality

document.addEventListener('DOMContentLoaded', function () {
    // Handle "Other" checkbox/radio reveal
    const otherCheckboxes = document.querySelectorAll('.qp-option-item input[value="Other"]');

    otherCheckboxes.forEach(input => {
        input.addEventListener('change', function () {
            const parentItem = this.closest('.qp-option-item');
            const otherInput = parentItem.querySelector('.qp-other-input');

            if (otherInput) {
                if (this.checked) {
                    otherInput.classList.add('active');
                    otherInput.setAttribute('required', 'required');
                } else {
                    otherInput.classList.remove('active');
                    otherInput.removeAttribute('required');
                    otherInput.value = '';
                }
            }
        });
    });

    // Form submission - ensure Quick Pick data is included
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            // Collect selected services
            const selectedServices = [];
            const serviceCheckboxes = document.querySelectorAll('input[name="services[]"]:checked');

            serviceCheckboxes.forEach(checkbox => {
                if (checkbox.value === 'Other') {
                    const parentItem = checkbox.closest('.qp-option-item');
                    const otherInput = parentItem.querySelector('.qp-other-input');
                    if (otherInput && otherInput.value.trim()) {
                        selectedServices.push('Other: ' + otherInput.value.trim());
                    }
                } else {
                    selectedServices.push(checkbox.value);
                }
            });

            // Collect selected work type
            const workTypeRadio = document.querySelector('input[name="work_type"]:checked');
            let workType = '';

            if (workTypeRadio) {
                if (workTypeRadio.value === 'Other') {
                    const parentItem = workTypeRadio.closest('.qp-option-item');
                    const otherInput = parentItem.querySelector('.qp-other-input');
                    if (otherInput && otherInput.value.trim()) {
                        workType = 'Other: ' + otherInput.value.trim();
                    }
                } else {
                    workType = workTypeRadio.value;
                }
            }

            // Create hidden fields to pass Quick Pick data
            // Remove any existing quick-pick hidden fields first
            const existingFields = contactForm.querySelectorAll('.quick-pick-hidden');
            existingFields.forEach(field => field.remove());

            // Add services as a combined field
            if (selectedServices.length > 0) {
                const servicesField = document.createElement('input');
                servicesField.type = 'hidden';
                servicesField.name = 'quick_pick_services';
                servicesField.value = selectedServices.join(', ');
                servicesField.className = 'quick-pick-hidden';
                contactForm.appendChild(servicesField);
            }

            // Add work type
            if (workType) {
                const workTypeField = document.createElement('input');
                workTypeField.type = 'hidden';
                workTypeField.name = 'quick_pick_work_type';
                workTypeField.value = workType;
                workTypeField.className = 'quick-pick-hidden';
                contactForm.appendChild(workTypeField);
            }
        });
    }

    // View Example buttons - you can customize the links here
    const viewExampleBtn = document.querySelector('.qp-view-example-btn');
    if (viewExampleBtn) {
        viewExampleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            // You can add custom logic here to show examples
            window.open('https://bit.ly/Portfolio-Examples', '_blank');
        });
    }
});
