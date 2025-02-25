document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('connectionModal');
    const modalContent = document.querySelector('.modal-content');
    const closeBtn = document.querySelector('.modal-close');

    // Обработчик для кнопок подключения
    document.querySelectorAll('.tariff-card__button').forEach(button => {
        button.addEventListener('click', function() {
            const tariffId = this.dataset.tariffId;
            const tariffName = this.closest('.tariff-card').querySelector('.tariff-card__title').textContent;
            const tariffSpeed = this.closest('.tariff-card').querySelector('.tariff-card__speed').textContent;
            const tariffPrice = this.closest('.tariff-card').querySelector('.tariff-card__price').textContent;
            
            showConnectionModal(tariffId, tariffName, tariffSpeed, tariffPrice);
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

    // Обработка отправки формы
    const connectionForm = document.getElementById('connectionForm');
    if (connectionForm) {
        connectionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(connectionForm);
            
            try {
                const response = await fetch('/tariffs/connect', {
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

function showConnectionModal(tariffId, tariffName, tariffSpeed, tariffPrice) {
    const modal = document.getElementById('connectionModal');
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
