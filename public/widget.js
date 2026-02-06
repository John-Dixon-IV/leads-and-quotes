/**
 * LeadsAndQuotes Widget - Embeddable AI Chat Widget
 * Zero dependencies, plain JavaScript
 * Embeddable via: <script src="https://YOUR_DOMAIN/widget.js?key=API_KEY"></script>
 */

(function() {
  'use strict';

  // Configuration
  const API_BASE_URL = window.LEADS_WIDGET_API_URL || 'http://localhost:3000/api/v1/widget';

  // Extract API key from script tag
  const currentScript = document.currentScript || document.querySelector('script[src*="widget.js"]');
  if (!currentScript) {
    console.error('[LeadsWidget] Could not find script tag');
    return;
  }

  const scriptSrc = currentScript.getAttribute('src');
  const urlParams = new URLSearchParams(scriptSrc.split('?')[1] || '');
  const API_KEY = urlParams.get('key');

  if (!API_KEY) {
    console.error('[LeadsWidget] Missing API key. Use: <script src="widget.js?key=YOUR_KEY"></script>');
    return;
  }

  // Generate or retrieve session ID
  const SESSION_STORAGE_KEY = 'leads_widget_session_id';
  const MESSAGES_STORAGE_KEY = 'leads_widget_messages';

  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = generateUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  // State management
  let messages = [];
  let isOpen = false;
  let isLoading = false;
  let conversationEnded = false;
  let widgetConfig = null;

  // Load messages from storage
  try {
    const storedMessages = sessionStorage.getItem(MESSAGES_STORAGE_KEY);
    if (storedMessages) {
      messages = JSON.parse(storedMessages);
    }
  } catch (e) {
    console.warn('[LeadsWidget] Failed to load message history');
  }

  /**
   * Initialize widget on DOM ready
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createWidget);
    } else {
      createWidget();
    }
  }

  /**
   * Create widget container and shadow DOM
   */
  function createWidget() {
    // Create container
    const container = document.createElement('div');
    container.id = 'leads-widget-container';
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;';

    // Attach shadow DOM for style isolation
    const shadow = container.attachShadow({ mode: 'open' });

    // Append to body
    document.body.appendChild(container);

    // Fetch config and render
    fetchConfig().then(() => {
      render(shadow);

      // Show greeting if no messages
      if (messages.length === 0 && widgetConfig?.behavior?.greeting) {
        addMessage('ai', widgetConfig.behavior.greeting);
      }
    });
  }

  /**
   * Fetch widget configuration
   */
  async function fetchConfig() {
    try {
      const response = await fetch(`${API_BASE_URL}/config`, {
        method: 'GET',
        headers: {
          'X-API-Key': API_KEY,
        },
      });

      if (response.ok) {
        widgetConfig = await response.json();
      } else {
        // Use defaults
        widgetConfig = {
          brand: {
            color: '#3B82F6',
            company_name: 'Support',
          },
          behavior: {
            greeting: 'Hi! How can we help you today?',
          },
        };
      }
    } catch (error) {
      console.warn('[LeadsWidget] Failed to fetch config, using defaults');
      widgetConfig = {
        brand: { color: '#3B82F6', company_name: 'Support' },
        behavior: { greeting: 'Hi! How can we help you today?' },
      };
    }
  }

  /**
   * Render widget UI into shadow DOM
   */
  function render(shadow) {
    const primaryColor = widgetConfig?.brand?.color || '#3B82F6';

    shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        .widget-bubble {
          width: 60px;
          height: 60px;
          border-radius: 30px;
          background: ${primaryColor};
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .widget-bubble:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
        }

        .widget-bubble svg {
          width: 28px;
          height: 28px;
          fill: white;
        }

        .widget-window {
          display: none;
          flex-direction: column;
          width: 380px;
          height: 600px;
          max-height: calc(100vh - 100px);
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          position: fixed;
          bottom: 90px;
          right: 20px;
        }

        .widget-window.open {
          display: flex;
        }

        .widget-header {
          background: ${primaryColor};
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .widget-header h3 {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 16px;
          font-weight: 600;
        }

        .widget-close {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 24px;
          line-height: 1;
          padding: 0;
          width: 24px;
          height: 24px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        .widget-close:hover {
          opacity: 1;
        }

        .widget-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f9fafb;
        }

        .message {
          margin-bottom: 16px;
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .message.visitor {
          text-align: right;
        }

        .message-bubble {
          display: inline-block;
          max-width: 75%;
          padding: 10px 14px;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          line-height: 1.5;
        }

        .message.ai .message-bubble {
          background: white;
          color: #1f2937;
          border: 1px solid #e5e7eb;
          text-align: left;
        }

        .message.visitor .message-bubble {
          background: ${primaryColor};
          color: white;
          text-align: left;
        }

        .message.system .message-bubble {
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fcd34d;
          max-width: 100%;
          text-align: center;
          font-size: 13px;
        }

        .widget-input-area {
          padding: 16px;
          background: white;
          border-top: 1px solid #e5e7eb;
        }

        .widget-input-area.disabled {
          opacity: 0.6;
          pointer-events: none;
        }

        .input-wrapper {
          display: flex;
          gap: 8px;
        }

        .widget-input {
          flex: 1;
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        .widget-input:focus {
          border-color: ${primaryColor};
        }

        .widget-send {
          background: ${primaryColor};
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .widget-send:hover:not(:disabled) {
          opacity: 0.9;
        }

        .widget-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading-indicator {
          display: flex;
          gap: 4px;
          padding: 10px 14px;
        }

        .loading-dot {
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background: #9ca3af;
          animation: bounce 1.4s infinite ease-in-out;
        }

        .loading-dot:nth-child(1) { animation-delay: -0.32s; }
        .loading-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      </style>

      <div class="widget-bubble" id="widget-bubble">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
        </svg>
      </div>

      <div class="widget-window" id="widget-window">
        <div class="widget-header">
          <h3>${widgetConfig?.brand?.company_name || 'Chat'}</h3>
          <button class="widget-close" id="widget-close">&times;</button>
        </div>

        <div class="widget-messages" id="widget-messages"></div>

        <div class="widget-input-area" id="widget-input-area">
          <div class="input-wrapper">
            <input
              type="text"
              class="widget-input"
              id="widget-input"
              placeholder="Type your message..."
              autocomplete="off"
            />
            <button class="widget-send" id="widget-send">Send</button>
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const bubble = shadow.getElementById('widget-bubble');
    const closeBtn = shadow.getElementById('widget-close');
    const sendBtn = shadow.getElementById('widget-send');
    const input = shadow.getElementById('widget-input');

    bubble.addEventListener('click', toggleWidget);
    closeBtn.addEventListener('click', toggleWidget);
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !isLoading) {
        sendMessage();
      }
    });

    // Render messages
    renderMessages(shadow);
  }

  /**
   * Toggle widget open/close
   */
  function toggleWidget() {
    isOpen = !isOpen;
    const shadow = document.getElementById('leads-widget-container').shadowRoot;
    const window = shadow.getElementById('widget-window');

    if (isOpen) {
      window.classList.add('open');
      shadow.getElementById('widget-input').focus();
      scrollToBottom(shadow);
    } else {
      window.classList.remove('open');
    }
  }

  /**
   * Send message to backend
   */
  async function sendMessage() {
    const shadow = document.getElementById('leads-widget-container').shadowRoot;
    const input = shadow.getElementById('widget-input');
    const message = input.value.trim();

    if (!message || isLoading || conversationEnded) {
      return;
    }

    // Clear input
    input.value = '';

    // Add visitor message
    addMessage('visitor', message);

    // Show loading
    setLoading(shadow, true);

    try {
      const response = await fetch(`${API_BASE_URL}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: message,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        if (response.status === 429) {
          addMessage('system', 'You\'ve reached the message limit for this conversation. Our team will follow up with you shortly.');
          conversationEnded = true;
        } else {
          throw new Error(error.error || 'Failed to send message');
        }
      } else {
        const data = await response.json();

        // Add AI response
        addMessage('ai', data.reply_message);

        // Check if conversation ended
        if (data.conversation_ended) {
          conversationEnded = true;
          disableInput(shadow);
        }
      }
    } catch (error) {
      console.error('[LeadsWidget] Failed to send message:', error);
      addMessage('ai', 'Sorry, something went wrong. Please try again or contact us directly.');
    } finally {
      setLoading(shadow, false);
    }
  }

  /**
   * Add message to conversation
   */
  function addMessage(sender, content) {
    messages.push({ sender, content, timestamp: Date.now() });

    // Save to session storage
    try {
      sessionStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('[LeadsWidget] Failed to save message history');
    }

    // Render if widget exists
    if (document.getElementById('leads-widget-container')) {
      const shadow = document.getElementById('leads-widget-container').shadowRoot;
      renderMessages(shadow);
    }
  }

  /**
   * Render all messages
   */
  function renderMessages(shadow) {
    const messagesContainer = shadow.getElementById('widget-messages');

    messagesContainer.innerHTML = messages.map(msg => `
      <div class="message ${msg.sender}">
        <div class="message-bubble">${escapeHtml(msg.content)}</div>
      </div>
    `).join('');

    scrollToBottom(shadow);
  }

  /**
   * Set loading state
   */
  function setLoading(shadow, loading) {
    isLoading = loading;
    const messagesContainer = shadow.getElementById('widget-messages');
    const sendBtn = shadow.getElementById('widget-send');
    const input = shadow.getElementById('widget-input');

    sendBtn.disabled = loading;
    input.disabled = loading;

    // Remove existing loading indicator
    const existingLoader = shadow.querySelector('.loading-message');
    if (existingLoader) {
      existingLoader.remove();
    }

    if (loading) {
      const loader = document.createElement('div');
      loader.className = 'message ai loading-message';
      loader.innerHTML = `
        <div class="loading-indicator">
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
          <div class="loading-dot"></div>
        </div>
      `;
      messagesContainer.appendChild(loader);
      scrollToBottom(shadow);
    }
  }

  /**
   * Disable input when conversation ends
   */
  function disableInput(shadow) {
    const inputArea = shadow.getElementById('widget-input-area');
    const input = shadow.getElementById('widget-input');

    inputArea.classList.add('disabled');
    input.placeholder = 'Conversation ended - we\'ll be in touch!';
  }

  /**
   * Scroll messages to bottom
   */
  function scrollToBottom(shadow) {
    setTimeout(() => {
      const messagesContainer = shadow.getElementById('widget-messages');
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 100);
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Generate UUID v4
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Initialize widget
  init();
})();
