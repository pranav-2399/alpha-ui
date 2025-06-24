export function showLoading(show = true) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.classList.toggle('hidden', !show);
    }
}

export function hideLoading() {
    showLoading(false);
}

export function showError(message) {
    // Show error in a visible error state div if it exists, else alert
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    if (errorState && errorMessage) {
        errorState.classList.remove('hidden');
        errorMessage.textContent = message;
    } else {
        console.error('Error:', message);
        alert(message);
    }
}