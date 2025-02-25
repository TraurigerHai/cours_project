document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('guestConnectionModal');
    const modalContent = document.querySelector('.modal-content');
    const closeBtn = document.querySelector('.modal-close');

    // Обработчик для кнопок подключения
    document.querySelectorAll('.tariff-card__button').forEach(button => {
        button.addEventListener('click', function() {
            const tariffId = this.dataset.tariffId;
            
            if (this.classList.contains('tariff-card__button--guest')) {
                // Для гостей показываем модальное окно
                const tariffCard = this.closest('.tariff-card');
                const tariffName = tariffCard.querySelector('.tariff-card__title').textContent;
                const tariffSpeed = tariffCard.querySelector('.tariff-card__speed').textContent;
                const tariffPrice = tariffCard.querySelector('.tariff-card__price').textContent;
                showGuestConnectionModal(tariffId, tariffName, tariffSpeed, tariffPrice);
            } else {
                // Для авторизованных пользователей делаем редирект
                window.location.href = `/tariffs?connect=${tariffId}`;
            }
        });
    });

    // Закрытие модального окна
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Закрытие по клику вне модального окна
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Маска для телефона
    const phoneInput = document.getElementById('guest_phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let x = e.target.value.replace(/\D/g, '')
                .match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,4})/);
            e.target.value = !x[2] ? x[1] : '7' + x[2] + (x[3] ? x[3] : '') + (x[4] ? x[4] : '');
        });
    }

    // Обработка отправки формы
    const guestConnectionForm = document.getElementById('guestConnectionForm');
    if (guestConnectionForm) {
        guestConnectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(guestConnectionForm);
            
            try {
                const response = await fetch('/tariffs/guest-connect', {
                    method: 'POST',
                    body: JSON.stringify(Object.fromEntries(formData)),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    modal.style.display = 'none';
                    showSuccessMessage('Заявка успешно отправлена! Наш специалист свяжется с вами в ближайшее время.');
                } else {
                    throw new Error('Ошибка отправки заявки');
                }
            } catch (error) {
                showErrorMessage('Произошла ошибка при отправке заявки. Пожалуйста, попробуйте позже.');
            }
        });
    }
});

function showGuestConnectionModal(tariffId, tariffName, tariffSpeed, tariffPrice) {
    const modal = document.getElementById('guestConnectionModal');
    const tariffInfo = modal.querySelector('.tariff-info');
    const hiddenInput = modal.querySelector('input[name="tariffId"]');
    
    tariffInfo.innerHTML = `
        <h3>${tariffName}</h3>
        <p>Скорость: ${tariffSpeed}</p>
        <p>Стоимость: ${tariffPrice}</p>
    `;
    
    hiddenInput.value = tariffId;
    modal.style.display = 'block';
}

function showSuccessMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message success-message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 5000);
}

function showErrorMessage(message) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message error-message';
    messageEl.textContent = message;
    document.body.appendChild(messageEl);
    setTimeout(() => messageEl.remove(), 5000);
}
