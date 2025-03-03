function showEditModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'block';
    }
}

function closeEditModal() {
    const modal = document.getElementById('editProfileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Обработчик клика вне модального окна
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('editProfileModal');
        if (event.target === modal) {
            closeEditModal();
        }
    });

    // Обработчик формы
    const editProfileForm = document.getElementById('editProfileForm');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const login = document.getElementById('editLogin').value;
            const password = document.getElementById('editPassword').value;
            const passwordConfirm = document.getElementById('editPasswordConfirm').value;

            // Валидация логина
            if (login.length < 3) {
                showErrorMessage('Логин должен содержать минимум 3 символа');
                return;
            }

            // Валидация паролей
            if (password && password !== passwordConfirm) {
                showErrorMessage('Пароли не совпадают');
                return;
            }

            const formData = new FormData(editProfileForm);
            const data = Object.fromEntries(formData);

            try {
                const response = await fetch('/profile/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const result = await response.json();

                if (result.success) {
                    showSuccessMessage('Профиль успешно обновлен');
                    closeEditModal();
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    showErrorMessage(result.error || 'Ошибка при обновлении профиля');
                }
            } catch (error) {
                showErrorMessage('Произошла ошибка при обновлении профиля');
            }
        });
    }
});

function showSuccessMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message success-message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 3000);
}

function showErrorMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message error-message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 3000); 
}

function generateProfilePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Set font
    doc.setFont('helvetica', 'normal');
    
    // Add header
    doc.setFontSize(20);
    doc.text('User Profile Data', 20, 20);
    
    // Add logo
    doc.setFontSize(24);
    doc.text('🌐', 180, 20);
    
    // Add generation date
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('en-US');
    doc.text(`Generated on: ${currentDate}`, 20, 30);
    
    // Add line
    doc.setLineWidth(0.5);
    doc.line(20, 35, 190, 35);

    // Get user data safely by direct label matching
    const infoGroups = document.querySelectorAll('.info-group');
    const userInfo = {
        login: '',
        email: '',
        contract: 'Not specified'
    };

    infoGroups.forEach(group => {
        const label = group.querySelector('label').textContent.toLowerCase();
        const value = group.querySelector('p').textContent;
        
        if (label.includes('логин')) userInfo.login = value;
        if (label.includes('email')) userInfo.email = value;
        if (label.includes('договора')) userInfo.contract = value;
    });

    // Add personal information
    doc.setFontSize(16);
    doc.text('Personal Information:', 20, 50);
    
    doc.setFontSize(12);
    doc.text(`Username: ${userInfo.login}`, 30, 60);
    doc.text(`Email: ${userInfo.email}`, 30, 70);
    doc.text(`Contract Number: ${userInfo.contract}`, 30, 80);

    // Get tariff data safely
    const tariffSection = document.querySelector('.profile-tariff');
    let tariffInfo = null;

    if (tariffSection && tariffSection.querySelector('.current-tariff h3')) {
        tariffInfo = {
            name: tariffSection.querySelector('.current-tariff h3').textContent,
            speed: tariffSection.querySelector('.tariff-speed')?.textContent || 'Not specified',
            price: tariffSection.querySelector('.tariff-price')?.textContent || 'Not specified',
            status: tariffSection.querySelector('.tariff-status')?.textContent || 'Not specified'
        };
    }

    // Add tariff information if exists
    if (tariffInfo) {
        doc.setFontSize(16);
        doc.text('Tariff Information:', 20, 100);
        
        doc.setFontSize(12);
        doc.text(`Name: ${tariffInfo.name}`, 30, 110);
        doc.text(`Speed: ${tariffInfo.speed}`, 30, 120);
        doc.text(`Price: ${tariffInfo.price}`, 30, 130);
        doc.text(`Status: ${tariffInfo.status}`, 30, 140);
    } else {
        doc.setFontSize(12);
        doc.text('No active tariff', 30, 100);
    }

    // Get statistics safely
    const statsItems = document.querySelectorAll('.stat-item');
    const stats = {
        balance: 'Not specified',
        paymentDate: 'Not specified'
    };

    statsItems.forEach(item => {
        const label = item.querySelector('.stat-label').textContent.toLowerCase();
        const value = item.querySelector('.stat-value').textContent;
        
        if (label.includes('баланс')) stats.balance = value;
        if (label.includes('дата')) stats.paymentDate = value;
    });

    // Add account statistics
    doc.setFontSize(16);
    doc.text('Account Statistics:', 20, 160);
    
    doc.setFontSize(12);
    doc.text(`Balance: ${stats.balance}`, 30, 170);
    doc.text(`Payment Date: ${stats.paymentDate}`, 30, 180);

    // Add footer
    doc.setFontSize(10);
    doc.text('This document was generated automatically', 20, 280);
    doc.text(currentDate, 20, 290);

    // Save the PDF
    const fileName = `profile_${userInfo.login.replace(/\s+/g, '_')}_${currentDate.replace(/\//g, '-')}.pdf`;
    doc.save(fileName);
}
