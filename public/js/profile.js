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
