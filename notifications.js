// notifications.js
export function setupNotifications() {
  // Notification function
  function showNotification(message, type = 'success') {
    console.log("Showing notification:", message, type);
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notification-container');
    container.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Export function
  window.showNotification = showNotification;
}
