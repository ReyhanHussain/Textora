// Get Supabase credentials from environment or config
const SUPABASE_URL = (window.appConfig && window.appConfig.supabase.url) || process.env.SUPABASE_URL;
const SUPABASE_KEY = (window.appConfig && window.appConfig.supabase.key) || process.env.SUPABASE_KEY;
let supabaseClient;

// Constants
const ALLOWED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking characters: 0, 1, I, O
const CODE_LENGTH = 4;
const RATE_LIMIT_SECONDS = window.appConfig ? window.appConfig.app.rateLimit : 10;
const BASE_URL = window.appConfig ? window.appConfig.app.baseUrl : 'https://r-h.netlify.app';

// Initialize page-specific functionality
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Supabase client
    try {
        if (typeof supabase !== 'undefined') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log('Supabase client initialized');
        } else {
            console.error('Supabase library not loaded');
            showNotification('Database connection error', 'error');
        }
    } catch (error) {
        console.error('Failed to initialize Supabase:', error);
        showNotification('Database connection error', 'error');
    }
    
    // Mobile navigation setup
    setupMobileNavigation();
    
    // Form-related functionality
    setupCharacterCounter();
    setupCopyButtons();
    setupTryAgainButton();
    
    // Setup QR code buttons - do this after DOM is fully loaded
    setTimeout(() => {
        // Only setup buttons if they exist on the current page
        if (document.getElementById('share-qr')) {
            setupQRCodeButton('share-qr', 'qrcode-modal', 'qrcode', 'download-qr-btn', 'qr-close', '#note-link');
        }
        if (document.getElementById('share-qr-view')) {
            setupQRCodeButton('share-qr-view', 'qrcode-modal-view', 'qrcode-view', 'download-qr-view-btn', 'qr-close-view', '#note-share-link');
        }
    }, 500);
    
    // Initialize page-specific code
    if (window.location.pathname.includes('create.html')) {
        initCreatePage();
    } else if (window.location.pathname.includes('view.html')) {
        initViewPage();
    }
});

// Test the Supabase connection
async function testSupabaseConnection() {
    try {
        // Try a simple query to test the connection
        const { data, error } = await supabaseClient
            .from('notes')
            .select('id')
            .limit(1);
        
        if (error) {
            console.error('Supabase connection test failed:', error);
            showNotification('Database connection issue. Some features may not work.', 'error');
        } else {
            console.log('Supabase connection test successful');
        }
    } catch (err) {
        console.error('Error testing Supabase connection:', err);
    }
}

// Utility functions
function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

// Notification system
function showNotification(message, type = 'default', duration = 3000) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification elements
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let icon = '💬';
    if (type === 'error') icon = '⚠️';
    if (type === 'success') icon = '✓';
    
    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <p class="notification-message">${message}</p>
        <button class="notification-close">×</button>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Show notification with animation
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Add event listener to close button
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    }
}

// Modal system
function createModal(title, content, buttons = []) {
    // Remove existing modal if present
    const existingModal = document.querySelector('.modal-backdrop');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal elements
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    
    const modalEl = document.createElement('div');
    modalEl.className = 'modal';
    
    // Header with title
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h3');
    modalTitle.className = 'modal-title';
    modalTitle.textContent = title;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => closeModal(modalBackdrop));
    
    modalHeader.appendChild(modalTitle);
    modalEl.appendChild(closeButton);
    modalEl.appendChild(modalHeader);
    
    // Body with content
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';
    
    // Content can be a string or a DOM element
    if (typeof content === 'string') {
        modalBody.innerHTML = content;
    } else {
        modalBody.appendChild(content);
    }
    
    modalEl.appendChild(modalBody);
    
    // Footer with buttons
    if (buttons.length > 0) {
        const modalFooter = document.createElement('div');
        modalFooter.className = 'modal-footer';
        
        buttons.forEach(button => {
            const btnEl = document.createElement('button');
            btnEl.className = `btn ${button.className || ''}`;
            btnEl.textContent = button.text;
            btnEl.addEventListener('click', () => {
                if (button.callback) {
                    button.callback();
                }
                if (button.closeModal !== false) {
                    closeModal(modalBackdrop);
                }
            });
            modalFooter.appendChild(btnEl);
        });
        
        modalEl.appendChild(modalFooter);
    }
    
    // Add modal to backdrop
    modalBackdrop.appendChild(modalEl);
    
    // Add to DOM
    document.body.appendChild(modalBackdrop);
    
    // Animate in
    setTimeout(() => modalBackdrop.classList.add('active'), 10);
    
    // Close when clicking backdrop
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            closeModal(modalBackdrop);
        }
    });
    
    // Return the modal for potential further manipulation
    return { backdrop: modalBackdrop, modal: modalEl };
}

function closeModal(modalBackdrop) {
    modalBackdrop.classList.remove('active');
    setTimeout(() => {
        if (document.body.contains(modalBackdrop)) {
            modalBackdrop.remove();
        }
    }, 300);
}

function showTermsModal() {
    createModal('Terms of Service', `
        <h4>1. Acceptance of Terms</h4>
        <p>By accessing or using TempText, you agree to be bound by these Terms of Service.</p>
        
        <h4>2. Service Description</h4>
        <p>TempText provides temporary text storage with automatic deletion after a set time period.</p>
        
        <h4>3. User Conduct</h4>
        <p>You agree not to use the service for any illegal, harmful, or offensive content.</p>
        
        <h4>4. Content Responsibility</h4>
        <p>You are solely responsible for the content you share through TempText.</p>
        
        <h4>5. No Warranty</h4>
        <p>The service is provided "as is" without any warranty of any kind.</p>
        
        <h4>6. Limitation of Liability</h4>
        <p>TempText shall not be liable for any indirect, incidental, or consequential damages.</p>
        
        <h4>7. Changes to Terms</h4>
        <p>We reserve the right to modify these terms at any time.</p>
        
        <h4>8. Governing Law</h4>
        <p>These terms are governed by the laws of the jurisdiction where TempText operates.</p>
    `, [
        { text: 'Close', className: 'btn-secondary' }
    ]);
}

function showPrivacyModal() {
    createModal('Privacy Policy', `
        <h4>1. Information We Collect</h4>
        <p>TempText collects only the text content you choose to share and your selected expiration time.</p>
        
        <h4>2. How We Use Your Information</h4>
        <p>We use this information solely to provide the temporary note service.</p>
        
        <h4>3. Data Storage</h4>
        <p>Your data is stored securely and automatically deleted after the expiration time.</p>
        
        <h4>4. No Tracking</h4>
        <p>We do not use cookies or tracking technologies to monitor users.</p>
        
        <h4>5. Data Sharing</h4>
        <p>We do not share your data with third parties except as required by law.</p>
        
        <h4>6. Security</h4>
        <p>We implement security measures to protect your data during its temporary storage.</p>
        
        <h4>7. Changes to Privacy Policy</h4>
        <p>We may update this policy and will notify users of any changes.</p>
    `, [
        { text: 'Close', className: 'btn-secondary' }
    ]);
}

function generateRandomCode() {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        const randomIndex = Math.floor(Math.random() * ALLOWED_CHARS.length);
        code += ALLOWED_CHARS[randomIndex];
    }
    return code;
}

function formatTimeRemaining(expiryTime) {
    const now = new Date();
    const expiry = new Date(expiryTime);
    const diffMs = expiry - now;
    
    if (diffMs <= 0) return 'Expired';
    
    const diffSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);
    const seconds = diffSecs % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Rate limiting
let lastNoteCreationTime = 0;

function checkRateLimit() {
    const now = Date.now();
    const timeSinceLastCreation = (now - lastNoteCreationTime) / 1000;
    
    if (timeSinceLastCreation < RATE_LIMIT_SECONDS) {
        return false;
    }
    
    lastNoteCreationTime = now;
    return true;
}

// Mobile navigation setup
function setupMobileNavigation() {
    const hamburger = document.getElementById('hamburger-menu');
    const navLinks = document.getElementById('nav-links');
    const overlay = document.getElementById('nav-overlay');
    
    if (hamburger && navLinks && overlay) {
        hamburger.addEventListener('click', function(e) {
            // Prevent default button behavior
            e.preventDefault();
            e.stopPropagation();
            
            // Toggle active classes
            this.classList.toggle('active');
            navLinks.classList.toggle('active');
            overlay.classList.toggle('active');
            
            // Prevent scrolling when menu is open
            document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
        });
        
        overlay.addEventListener('click', function() {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            this.classList.remove('active');
            document.body.style.overflow = '';
        });
        
        const navItems = navLinks.querySelectorAll('a');
        navItems.forEach(item => {
            item.addEventListener('click', function() {
                hamburger.classList.remove('active');
                navLinks.classList.remove('active');
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }
}

// Character counter setup
function setupCharacterCounter() {
    const noteContentTextarea = document.getElementById('note-content');
    const charCountDisplay = document.getElementById('char-count');
    
    if (noteContentTextarea && charCountDisplay) {
        noteContentTextarea.addEventListener('input', () => {
            charCountDisplay.textContent = noteContentTextarea.value.length;
        });
    }
}

// Copy functionality setup
function setupCopyButtons() {
    const setupCopyButton = (buttonId, textSelector) => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                const textElement = document.querySelector(textSelector);
                if (textElement) {
                    navigator.clipboard.writeText(textElement.textContent || textElement.value)
                        .then(() => {
                            showNotification('Copied to clipboard!', 'success', 2000);
                        })
                        .catch(err => {
                            console.error('Failed to copy text: ', err);
                            showNotification('Failed to copy text', 'error');
                        });
                }
            });
        }
    };
    
    setupCopyButton('copy-code-btn', '#generated-code');
    setupCopyButton('copy-link-btn', '#note-link');
    setupCopyButton('copy-share-link-btn', '#note-share-link');
    
    // Setup share buttons
    setupShareButtons();
}

// Try again button setup
function setupTryAgainButton() {
    const tryAgainBtn = document.getElementById('try-again-btn');
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
            document.getElementById('note-error').classList.add('hidden');
            document.getElementById('code-input-section').classList.remove('hidden');
        });
    }
}

// QR Code functionality
function setupQRCodeButton(buttonId, modalId, qrElementId, downloadBtnId, closeId, linkSelector) {
    const qrButton = document.getElementById(buttonId);
    const modal = document.getElementById(modalId);
    const closeBtn = document.querySelector(`.${closeId}`);
    const downloadBtn = document.getElementById(downloadBtnId);
    
    // Get share button ID based on whether it's the main or view page
    const shareBtn = document.getElementById(qrElementId === 'qrcode' ? 'share-qr-btn' : 'share-qr-view-btn');
    
    if (!qrButton || !modal) return;
    
    // Open modal when QR button is clicked
    qrButton.addEventListener('click', () => {
        const linkElement = document.querySelector(linkSelector);
        if (!linkElement) return;
        
        const url = linkElement.value;
        
        // Clear previous QR code
        const qrElement = document.getElementById(qrElementId);
        if (qrElement) {
            qrElement.innerHTML = '';
            
            // Generate high-quality QR code
            try {
                new QRCode(qrElement, {
                    text: url,
                    width: 200,  // Larger size for better clarity
                    height: 200,
                    colorDark: '#111111',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (error) {
                console.error('Error generating QR code:', error);
                showNotification('Error generating QR code', 'error');
            }
        }
        
        // Show modal
        modal.classList.add('show');
        modal.classList.remove('hidden');
    });
    
    // Close modal when X is clicked
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        });
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            modal.classList.add('hidden');
        }
    });
    
    // Download QR code
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            downloadQRCode(qrElementId);
        });
    }
    
    // Share QR code image
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            shareQRCode(qrElementId, linkSelector);
        });
    }
}

// Share QR code via Web Share API or fallback
function shareQRCode(qrElementId, linkSelector) {
    const qrElement = document.getElementById(qrElementId);
    const linkElement = document.querySelector(linkSelector);
    
    if (!qrElement || !linkElement) return;
    
    const url = linkElement.value;
    const title = 'TempText - QR Code';
    const text = 'Scan this QR code to view the temporary note:';
    
    // Try to share the QR code image if possible
    if (navigator.share) {
        // First try to share the image if we can get it
        const img = qrElement.querySelector('img');
        if (img) {
            try {
                // Create a canvas with the QR code
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width * 2;
                canvas.height = img.height * 2;
                
                // Draw white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Draw QR code
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convert to blob for sharing
                canvas.toBlob(async (blob) => {
                    try {
                        // Try to share the image
                        if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'qrcode.png', { type: 'image/png' })] })) {
                            await navigator.share({
                                title: title,
                                text: text,
                                files: [new File([blob], 'qrcode.png', { type: 'image/png' })]
                            });
                            showNotification('QR code shared!', 'success');
                        } else {
                            // Fall back to sharing just the URL
                            await navigator.share({
                                title: title,
                                text: text,
                                url: url
                            });
                            showNotification('Link shared!', 'success');
                        }
                    } catch (err) {
                        console.error('Error sharing:', err);
                        if (err.name !== 'AbortError') {
                            showNotification('Failed to share', 'error');
                        }
                    }
                }, 'image/png');
            } catch (err) {
                // If canvas operations fail, fall back to sharing the URL
                shareUrl(url, title, text);
            }
        } else {
            // No image found, share the URL
            shareUrl(url, title, text);
        }
    } else {
        // Web Share API not supported, copy to clipboard instead
        navigator.clipboard.writeText(url)
            .then(() => {
                showNotification('Link copied to clipboard!', 'success');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                showNotification('Failed to copy link', 'error');
            });
    }
}

// Helper function to share URL
async function shareUrl(url, title, text) {
    try {
        await navigator.share({
            title: title,
            text: text,
            url: url
        });
        showNotification('Link shared!', 'success');
    } catch (err) {
        console.error('Error sharing URL:', err);
        if (err.name !== 'AbortError') {
            showNotification('Failed to share', 'error');
        }
    }
}

function downloadQRCode(qrElementId) {
    const qrElement = document.getElementById(qrElementId);
    if (!qrElement) return;
    
    const img = qrElement.querySelector('img');
    if (!img) return;
    
    // Create canvas for better quality
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = img.width * 4;  // Increased size for better quality
    canvas.height = img.height * 4;
    
    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw QR code with margin
    const margin = canvas.width * 0.1;
    const size = canvas.width - (margin * 2);
    ctx.drawImage(img, margin, margin, size, size);
    
    // Add a small branding text at the bottom
    ctx.font = '14px Arial';
    ctx.fillStyle = '#111111';
    ctx.textAlign = 'center';
    ctx.fillText('TempText', canvas.width / 2, canvas.height - 10);
    
    // Download
    const link = document.createElement('a');
    link.download = 'temptext-qrcode.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('QR code downloaded!', 'success', 2000);
}

// Create page functionality
async function initCreatePage() {
    const createNoteBtn = document.getElementById('create-note-btn');
    if (!createNoteBtn) return;
    
    createNoteBtn.addEventListener('click', async () => {
        if (!checkRateLimit()) {
            showNotification(`Please wait ${RATE_LIMIT_SECONDS} seconds between creating notes.`, 'error');
            return;
        }
        
        const noteContent = document.getElementById('note-content').value.trim();
        const expiryMinutes = parseInt(document.getElementById('expiry-time').value);
        
        if (!noteContent) {
            showNotification('Please enter note content', 'error');
            return;
        }
        
        if (noteContent.length > 500) {
            showNotification('Note content exceeds 500 characters', 'error');
            return;
        }
        
        createNoteBtn.disabled = true;
        createNoteBtn.textContent = 'Creating...';
        
        try {
            const noteCode = await createNoteWithUniqueCode(sanitizeInput(noteContent), expiryMinutes);
            
            if (noteCode) {
                document.getElementById('generated-code').textContent = noteCode;
                const noteLink = `${BASE_URL}/view.html?code=${noteCode}`;
                document.getElementById('note-link').value = noteLink;
                document.getElementById('expiry-time-display').textContent = `${expiryMinutes} minute${expiryMinutes !== 1 ? 's' : ''}`;
                
                document.getElementById('note-form').classList.add('hidden');
                document.getElementById('note-result').classList.remove('hidden');
                

                
                showNotification('Note created successfully!', 'success');
            }
        } catch (error) {
            console.error('Error creating note:', error);
            showNotification('Failed to create note. Please try again.', 'error');
        } finally {
            createNoteBtn.disabled = false;
            createNoteBtn.textContent = 'Create Note';
        }
    });
}

async function createNoteWithUniqueCode(content, expiryMinutes) {
    // Check if Supabase is initialized
    if (!supabaseClient) {
        console.error('Supabase client not initialized');
        throw new Error('Database connection not available');
    }
    
    // Try up to 5 times to generate a unique code
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRandomCode();
        
        try {
            const { data: existingNote } = await supabaseClient
                .from('notes')
                .select('code')
                .eq('code', code)
                .single();
            
            if (!existingNote) {
                const now = new Date();
                const expiryTime = new Date(now.getTime() + expiryMinutes * 60 * 1000);
                
                const { data, error } = await supabaseClient
                    .from('notes')
                    .insert([
                        {
                            code: code,
                            content: content,
                            created_at: now.toISOString(),
                            expires_at: expiryTime.toISOString()
                        }
                    ]);
                
                if (!error) {
                    return code;
                }
            }
        } catch (error) {
            console.error(`Supabase error on attempt ${attempt + 1}/5:`, error.message || error);
            // Add exponential backoff before retrying
            if (attempt < 4) {
                await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
            }
        }
    }
    
    throw new Error('Could not generate a unique code. Please try again.');
}

// View page functionality
async function initViewPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const codeFromUrl = urlParams.get('code');
    
    if (codeFromUrl) {
        await loadNote(codeFromUrl.toUpperCase());
    } else {
        const viewNoteBtn = document.getElementById('view-note-btn');
        if (viewNoteBtn) {
            viewNoteBtn.addEventListener('click', async () => {
                const noteCode = document.getElementById('note-code').value.trim().toUpperCase();
                
                if (noteCode.length !== CODE_LENGTH) {
                    showNotification(`Note code must be ${CODE_LENGTH} characters`, 'error');
                    return;
                }
                
                await loadNote(noteCode);
            });
        }
    }
}

async function loadNote(code) {
    try {
        document.getElementById('code-input-section').classList.add('hidden');
        
        // Check if Supabase is initialized
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            showNoteError('Database connection not available. Please try again later.');
            return;
        }
        
        const { data: note, error } = await supabaseClient
            .from('notes')
            .select('*')
            .eq('code', code)
            .single();
        
        if (error || !note) {
            showNoteError('Note not found. It may have been deleted or never existed.');
            return;
        }
        
        const now = new Date();
        const expiryTime = new Date(note.expires_at);
        
        if (expiryTime <= now) {
            showNoteError('This note has expired and is no longer available.');
            
            await supabaseClient
                .from('notes')
                .delete()
                .eq('code', code);
                
            return;
        }
        
        document.getElementById('display-code').textContent = note.code;
        document.getElementById('note-text').textContent = note.content;
        document.getElementById('note-display').classList.remove('hidden');
        
        // Set the share link
        const shareLink = document.getElementById('note-share-link');
        const noteLinkUrl = `${BASE_URL}/view.html?code=${note.code}`;
        if (shareLink) {
            shareLink.value = noteLinkUrl;
        }
        

        
        // Setup copy button for share link
        const copyShareBtn = document.getElementById('copy-share-link-btn');
        if (copyShareBtn) {
            copyShareBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(shareLink.value)
                    .then(() => {
                        showNotification('Link copied to clipboard!', 'success', 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy text: ', err);
                        showNotification('Failed to copy link', 'error');
                    });
            });
        }
        
        const countdownElement = document.getElementById('countdown-timer');
        const countdownInterval = setInterval(() => {
            countdownElement.textContent = formatTimeRemaining(expiryTime);
            
            if (new Date() >= expiryTime) {
                clearInterval(countdownInterval);
                document.getElementById('note-display').classList.add('hidden');
                showNoteError('This note has expired.');
            }
        }, 1000);
        
        countdownElement.textContent = formatTimeRemaining(expiryTime);
        
    } catch (error) {
        console.error('Error loading note:', error.message || error);
        showNoteError('An error occurred while loading the note.');
    }
}

function showNoteError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
    }
    
    document.getElementById('note-error').classList.remove('hidden');
}

// Share functionality
function setupShareButtons() {
    const shareButtons = [
        { id: 'share-whatsapp', viewId: 'share-whatsapp-view', urlGen: (url, title) => `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}` },
        { id: 'share-telegram', viewId: 'share-telegram-view', urlGen: (url, title) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
        { id: 'share-twitter', viewId: 'share-twitter-view', urlGen: (url, title) => `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
        { id: 'share-facebook', viewId: 'share-facebook-view', urlGen: (url, title) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
        { id: 'share-email', viewId: 'share-email-view', urlGen: (url, title) => `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent('Check out this temporary note: ' + url)}` }
    ];
    
    // Setup all share buttons
    shareButtons.forEach(btn => {
        setupSingleShareButton(btn.id, btn.urlGen);
        setupSingleShareButton(btn.viewId, btn.urlGen);
    });
    
    // Native share API (for mobile devices)
    setupNativeShare('share-native');
    setupNativeShare('share-native-view');
}

function setupSingleShareButton(buttonId, urlGenerator) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    
    button.addEventListener('click', () => {
        const noteLink = document.getElementById('note-link') || document.getElementById('note-share-link');
        if (!noteLink) return;
        
        const url = noteLink.value;
        const title = 'TempText - Temporary Note';
        const shareUrl = urlGenerator(url, title);
        
        // Open in new window
        window.open(shareUrl, '_blank', 'width=600,height=400');
        showNotification('Opening share window...', 'success', 2000);
    });
}

function setupNativeShare(buttonId) {
    const nativeShareBtn = document.getElementById(buttonId);
    if (!nativeShareBtn) return;
    
    if (navigator.share) {
        nativeShareBtn.addEventListener('click', async () => {
            const noteLink = document.getElementById('note-link') || document.getElementById('note-share-link');
            if (!noteLink) return;
            
            const url = noteLink.value;
            const title = 'TempText - Temporary Note';
            
            try {
                await navigator.share({
                    title: title,
                    text: 'Check out this temporary note:',
                    url: url
                });
                showNotification('Shared successfully!', 'success');
            } catch (err) {
                console.error('Error sharing:', err);
                if (err.name !== 'AbortError') {
                    showNotification('Failed to share', 'error');
                }
            }
        });
    } else {
        // Hide native share button if not supported
        nativeShareBtn.style.display = 'none';
    }
}