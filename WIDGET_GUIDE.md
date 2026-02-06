# Widget Embed Guide

## Overview

The LeadsAndQuotes widget is a self-contained, zero-dependency JavaScript widget that can be embedded on any website with a single `<script>` tag.

## Features

✅ **Zero dependencies** - Pure vanilla JavaScript
✅ **Non-blocking** - Loads asynchronously, won't slow down your site
✅ **Style isolation** - Uses Shadow DOM to prevent CSS conflicts
✅ **Multi-turn conversations** - Supports back-and-forth dialog
✅ **Session persistence** - Remembers conversations using sessionStorage
✅ **Responsive design** - Works on desktop and mobile
✅ **Error handling** - Graceful fallbacks for network issues
✅ **Works everywhere** - WordPress, Wix, Shopify, static sites, etc.

## Quick Start

### 1. Get Your API Key

After customer onboarding, you'll receive a unique API key. For development:

```bash
npm run db:seed
```

This will output an API key like:
```
API Key: abc123def456...
```

### 2. Embed the Widget

Add this single line to your website, just before the closing `</body>` tag:

```html
<script src="https://YOUR_DOMAIN/widget.js?key=YOUR_API_KEY"></script>
```

**Example:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>Joe's Contracting</title>
</head>
<body>
  <h1>Welcome to Joe's Contracting</h1>
  <p>Get a free quote today!</p>

  <!-- LeadsAndQuotes Widget -->
  <script src="https://leads.example.com/widget.js?key=abc123def456"></script>
</body>
</html>
```

### 3. Done!

The widget will automatically:
- Load without blocking your page
- Render a chat bubble in the bottom-right corner
- Greet visitors when they open it
- Capture leads and generate quotes using AI
- Remember conversations across page refreshes

## Customization

### Change API Base URL (Development)

By default, the widget connects to the server it was loaded from. For local development:

```html
<script>
  window.LEADS_WIDGET_API_URL = 'http://localhost:3000/api/v1/widget';
</script>
<script src="http://localhost:3000/widget.js?key=YOUR_API_KEY"></script>
```

### Widget Appearance

Widget branding (colors, logo, company name) is controlled server-side via the customer's configuration. Update via the dashboard API (coming in Step 3).

## Technical Details

### Architecture

1. **Script Load**: The `<script>` tag loads `widget.js` asynchronously
2. **Initialization**: Widget extracts API key from its own `src` URL
3. **Session Management**: Generates a UUID session ID, stores in sessionStorage
4. **Shadow DOM**: Creates an isolated container to prevent CSS conflicts
5. **Configuration Fetch**: Retrieves branding/behavior from `/api/v1/widget/config`
6. **Message Exchange**: POSTs visitor messages to `/api/v1/widget/message`
7. **Response Rendering**: Displays AI responses in the chat UI

### Session Persistence

The widget uses `sessionStorage` to persist:
- Session ID (UUID v4)
- Conversation history
- Conversation state (open/closed, ended)

Data is automatically cleared when the browser session ends (tab/window closed).

### Style Isolation

The widget uses **Shadow DOM** to isolate its styles from the host page. This ensures:
- No CSS conflicts with your website
- Widget styles won't leak out
- Your site's styles won't affect the widget

### Browser Support

- ✅ Chrome 53+
- ✅ Firefox 63+
- ✅ Safari 10.1+
- ✅ Edge 79+

Shadow DOM is widely supported in all modern browsers.

### Security

- **No API Key Exposure**: API keys are passed via URL parameter but only used server-side
- **XSS Protection**: All user input is escaped before rendering
- **CORS**: Widget script served with proper CORS headers
- **Rate Limiting**: Backend enforces message limits per session
- **Session Isolation**: Each visitor gets a unique session ID

### Performance

- **File Size**: ~12KB unminified (~4KB gzipped)
- **Load Time**: Non-blocking, loads asynchronously
- **No External Dependencies**: Zero HTTP requests to third-party CDNs
- **Caching**: Widget script cached for 1 hour in production

## Testing

### Local Development

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Open the demo page:
   ```
   http://localhost:3000/demo?key=YOUR_API_KEY
   ```

3. Or test on a minimal page:
   ```
   http://localhost:3000/demo.html
   ```

### Test Conversation

Try these example messages:
- "I need my deck repaired, it's about 200 square feet"
- "How much does fence installation cost?"
- "I need roofing work done"

The AI will:
1. Classify the service type
2. Determine urgency
3. Generate a price estimate (if confidence >= 0.6)
4. Ask clarifying questions if needed

### Debugging

Open browser DevTools console to see widget logs:
```
[LeadsWidget] Loaded successfully
[LeadsWidget] Session ID: 550e8400-e29b-41d4-a716-446655440000
[LeadsWidget] Config loaded
```

## Deployment

### Production Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Update `API_BASE_URL` in widget.js (or rely on automatic detection)
- [ ] Enable HTTPS (required for sessionStorage security)
- [ ] Configure CDN caching for `widget.js` (1 hour recommended)
- [ ] Test on staging site before deploying to customers

### CDN Deployment (Optional)

For maximum performance, serve `widget.js` via CDN:

1. Upload `public/widget.js` to your CDN
2. Update customer embed code:
   ```html
   <script src="https://cdn.example.com/widget.js?key=API_KEY"></script>
   ```

## Troubleshooting

### Widget Not Appearing

1. Check browser console for errors
2. Verify API key is correct
3. Ensure backend server is running
4. Check CORS headers (should allow all origins)

### Messages Not Sending

1. Open DevTools Network tab
2. Look for failed POST to `/api/v1/widget/message`
3. Check error response (401 = invalid API key, 429 = rate limited)
4. Verify backend is reachable from client

### Styles Conflicting

If you see style issues:
1. Verify Shadow DOM is supported (check `container.shadowRoot`)
2. Check for browser-specific issues
3. Ensure widget container has proper z-index

## Integration Examples

### WordPress

Add to footer.php before `</body>`:
```php
<script src="https://YOUR_DOMAIN/widget.js?key=<?php echo get_option('leads_widget_key'); ?>"></script>
```

### Wix

1. Go to Settings → Custom Code
2. Add code to "Body - End" section:
   ```html
   <script src="https://YOUR_DOMAIN/widget.js?key=YOUR_API_KEY"></script>
   ```

### Shopify

Add to `layout/theme.liquid` before `</body>`:
```liquid
<script src="https://YOUR_DOMAIN/widget.js?key={{ settings.leads_widget_key }}"></script>
```

### React/Next.js

Use `useEffect` to load dynamically:
```jsx
useEffect(() => {
  const script = document.createElement('script');
  script.src = 'https://YOUR_DOMAIN/widget.js?key=YOUR_API_KEY';
  script.async = true;
  document.body.appendChild(script);

  return () => {
    document.body.removeChild(script);
  };
}, []);
```

### Static HTML

Just add the script tag:
```html
<script src="https://YOUR_DOMAIN/widget.js?key=YOUR_API_KEY"></script>
```

## Support

For issues or questions:
- Check backend logs for API errors
- Review browser console for client-side errors
- Verify customer account is active and API key is valid

## Next Steps

- **Step 3**: Dashboard for customers to manage widget settings
- **Step 4**: Follow-up automation system
- **Step 5**: Analytics and lead tracking
