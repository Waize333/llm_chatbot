class ChatBot {
    constructor() {
        this.messageCount = 0;
        this.isTyping = false;
        this.currentPersonality = 'friendly';
        this.initializeElements();
        this.bindEvents();
        this.autoResizeTextarea();
        this.initializeTheme();
        this.setupAnimations();
    }

    initializeElements() {
        this.messageForm = document.getElementById('message-form');
        this.messageInput = document.getElementById('message-input');
        this.messagesContainer = document.getElementById('messages-container');
        this.sendBtn = document.getElementById('send-btn');
        this.personalitySelect = document.getElementById('personality');
        this.newChatBtn = document.getElementById('new-chat');
        this.exportChatBtn = document.getElementById('export-chat');
        this.messageCountEl = document.getElementById('message-count');
        this.themeToggle = document.getElementById('theme-toggle');
    }

    bindEvents() {
        this.messageForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.messageInput.addEventListener('keydown', (e) => this.handleKeydown(e));
        this.personalitySelect.addEventListener('change', (e) => this.changePersonality(e));
        this.newChatBtn.addEventListener('click', () => this.startNewChat());
        this.exportChatBtn.addEventListener('click', () => this.exportChat());
        this.themeToggle.addEventListener('change', () => this.toggleTheme());
        
        // Add ripple effect to send button
        this.sendBtn.addEventListener('click', (e) => this.createRipple(e));
    }

    initializeTheme() {
        const savedTheme = localStorage.getItem('chatbot-theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.setAttribute('data-theme', 'dark');
            this.themeToggle.checked = true;
        }
    }

    toggleTheme() {
        const isDark = this.themeToggle.checked;
        if (isDark) {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('chatbot-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('chatbot-theme', 'light');
        }
    }

    createRipple(event) {
        const button = event.currentTarget;
        const ripple = button.querySelector('.btn-ripple');
        
        if (ripple) {
            ripple.remove();
        }

        const circle = document.createElement('span');
        circle.classList.add('btn-ripple');
        
        const diameter = Math.max(button.clientHeight, button.clientWidth);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
        circle.style.top = `${event.clientY - button.offsetTop - radius}px`;

        button.appendChild(circle);
    }

    setupAnimations() {
        // Add stagger animation to existing messages
        const messages = document.querySelectorAll('.message');
        messages.forEach((message, index) => {
            message.style.animationDelay = `${index * 0.1}s`;
        });
    }

    autoResizeTextarea() {
        this.messageInput.addEventListener('input', () => {
            this.messageInput.style.height = 'auto';
            this.messageInput.style.height = this.messageInput.scrollHeight + 'px';
        });
    }

    handleKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit(e);
        }
    }

    handleSubmit(e) {
        e.preventDefault();
        const message = this.messageInput.value.trim();
        if (!message || this.isTyping) return;

        this.addMessage(message, 'user');
        this.messageInput.value = '';
        this.messageInput.style.height = 'auto';
        this.sendMessage(message);
    }

    addMessage(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';

        const avatar = document.createElement('div');
        avatar.className = type === 'user' ? 'user-avatar' : 'bot-avatar';
        
        if (type === 'user') {
            // User avatar with person icon instead of image
            avatar.innerHTML = `
                <div class="user-avatar-icon">
                    <i class="fas fa-user"></i>
                </div>
            `;
        } else {
            // Bot avatar with robot brain icon
            avatar.innerHTML = `
                <div class="avatar-inner">
                    <div class="avatar-core"></div>
                    <div class="avatar-ring"></div>
                    <i class="fas fa-robot avatar-icon"></i>
                </div>
            `;
        }

        const messageBubble = document.createElement('div');
        messageBubble.className = 'message-bubble';
        messageBubble.textContent = content;

        const messageTime = document.createElement('div');
        messageTime.className = 'message-time';
        messageTime.textContent = new Date().toLocaleTimeString();

        messageBubble.appendChild(messageTime);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageBubble);

        this.messagesContainer.appendChild(messageDiv);
        
        // Animate message appearance
        setTimeout(() => {
            messageDiv.style.transition = 'all 0.5s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 10);

        this.scrollToBottom();
        this.updateMessageCount();
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'enhanced-typing-indicator';
        typingDiv.id = 'typing-indicator';

        const avatar = document.createElement('div');
        avatar.className = 'bot-avatar';
        avatar.innerHTML = `
            <div class="avatar-inner">
                <div class="avatar-core"></div>
                <div class="avatar-ring"></div>
                <i class="fas fa-brain avatar-icon"></i>
            </div>
        `;

        const typingBubble = document.createElement('div');
        typingBubble.className = 'typing-bubble';
        typingBubble.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <span style="margin-left: 10px; color: var(--text-secondary);">AI is thinking...</span>
        `;

        typingDiv.appendChild(avatar);
        typingDiv.appendChild(typingBubble);
        this.messagesContainer.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.style.opacity = '0';
            typingIndicator.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                typingIndicator.remove();
            }, 300);
        }
    }

    async sendMessage(message) {
        this.isTyping = true;
        this.sendBtn.disabled = true;
        this.showTypingIndicator();

        try {
            const response = await fetch('/chatbot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: message,
                    personality: this.currentPersonality
                })
            });

            const data = await response.json();
            this.hideTypingIndicator();
            
            // Add delay for more natural feel
            setTimeout(() => {
                this.addMessage(data.response, 'bot');
            }, 500);
            
        } catch (error) {
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'bot');
            console.error('Error:', error);
        } finally {
            this.isTyping = false;
            this.sendBtn.disabled = false;
        }
    }

    changePersonality(e) {
        const personalities = {
            'friendly': '🤗',
            'professional': '💼',
            'technical': '🔧',
            'creative': '🎨'
        };
        
        this.currentPersonality = e.target.value;
        const emoji = personalities[e.target.value] || '🤖';
        this.addMessage(`${emoji} Switched to ${e.target.value} mode. How can I help you?`, 'bot');
    }

    async startNewChat() {
        try {
            await fetch('/new-session', { method: 'POST' });
            
            // Animate out existing messages
            const messages = this.messagesContainer.querySelectorAll('.message, .enhanced-typing-indicator');
            messages.forEach((msg, index) => {
                setTimeout(() => {
                    msg.style.opacity = '0';
                    msg.style.transform = 'translateX(-50px)';
                }, index * 50);
            });
            
            setTimeout(() => {
                this.messagesContainer.innerHTML = `
                    <div class="welcome-message">
                        <div class="bot-avatar">
                            <div class="avatar-inner">
                                <div class="avatar-core"></div>
                                <div class="avatar-ring"></div>
                                <i class="fas fa-brain avatar-icon"></i>
                            </div>
                        </div>
                        <div class="message-content">
                            <h3>Welcome! How can I assist you today?</h3>
                            <p>I'm your AI assistant, ready to help with various tasks. Choose a personality mode from the sidebar to customize my responses.</p>
                        </div>
                    </div>
                `;
                this.messageCount = 0;
                this.updateMessageCount();
            }, 500);
            
        } catch (error) {
            console.error('Error starting new chat:', error);
        }
    }

    async exportChat() {
        try {
            const response = await fetch('/export-chat');
            const data = await response.json();
            
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Show success animation
            this.showNotification('Chat exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting chat:', error);
            this.showNotification('Export failed. Please try again.', 'error');
        }
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 10px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            background: ${type === 'success' ? 'linear-gradient(45deg, #00d4ff, #667eea)' : 'linear-gradient(45deg, #ff6b6b, #ee5a24)'};
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    updateMessageCount() {
        this.messageCountEl.textContent = this.messageCount++;
        
        // Animate counter
        this.messageCountEl.style.transform = 'scale(1.2)';
        setTimeout(() => {
            this.messageCountEl.style.transform = 'scale(1)';
        }, 200);
    }

    scrollToBottom() {
        this.messagesContainer.scrollTo({
            top: this.messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// Initialize the chatbot when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChatBot();
});