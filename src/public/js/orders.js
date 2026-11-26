(function () {
  'use strict';

  document.addEventListener('click', async function (event) {
    const trigger = event.target.closest('[data-action="cancel-order"]');
    if (!trigger || trigger.disabled) {
      return;
    }

    const orderId = trigger.getAttribute('data-order-id');
    if (!orderId) {
      return;
    }

    const confirmed = window.confirm('Bạn có chắc muốn hủy đơn hàng này?');
    if (!confirmed) {
      return;
    }

    trigger.disabled = true;
    try {
      await window.ABMT.api.post(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {});
      window.location.reload();
    } catch (error) {
      window.ABMT.toast.error((error && error.message) || 'Không thể hủy đơn hàng');
      trigger.disabled = false;
    }
  });
})();
