export function openChatbot() {
    const modal = document.getElementById('chatbotModal');
    const backdrop = document.getElementById('modalBackdrop');
    const input = document.getElementById('chatInput');
    
    if (modal) modal.classList.remove('hidden');
    if (backdrop) backdrop.classList.remove('hidden');
    if (input) input.focus();
}

export function closeChatbot() {
    const modal = document.getElementById('chatbotModal');
    const backdrop = document.getElementById('modalBackdrop');
    
    if (modal) modal.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
}

export function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    addChatMessage(message, 'user');
    input.value = '';
    
    // Simulate API call to chatbot
    setTimeout(() => {
        const response = generateChatbotResponse(message);
        addChatMessage(response, 'bot');
    }, 1000);
}