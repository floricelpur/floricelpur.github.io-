// ========== UTILITY FUNCTIONS ==========

function parseNumber(text) {
    if (!text || text.trim() === '') return NaN;
    text = text.trim().replace(',', '.');
    return parseFloat(text);
}

function formatNumber(value, decimals) {
    if (value === Infinity || value === -Infinity) return '∞';
    if (value === null || value === undefined) return 'N/A';

    // If passed an object from chart data like {x, y}, prefer the numeric component
    if (typeof value === 'object') {
        if (value === null) return 'N/A';
        if (typeof value.x === 'number') value = value.x;
        else if (typeof value.y === 'number') value = value.y;
        else {
            // try to coerce object to number
            const coerced = Number(value);
            if (!Number.isFinite(coerced)) return 'N/A';
            value = coerced;
        }
    }

    // If value is a numeric string, parse it
    if (typeof value === 'string') {
        const normalized = value.trim().replace(',', '.');
        const parsed = parseFloat(normalized);
        if (Number.isFinite(parsed)) value = parsed;
        else return 'N/A';
    }

    if (typeof value !== 'number' || isNaN(value)) return 'N/A';
    const d = (typeof decimals === 'number' && decimals >= 0) ? decimals : 2;
    return value.toFixed(d);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getInputValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

function getInputChecked(id) {
    const element = document.getElementById(id);
    return element ? element.checked : false;
}

function setButtonState(buttonId, disabled) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = disabled;
    }
}

function updateProgress(value) {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = value + '%';
        progressBar.textContent = value + '%';
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('✅ Copied to clipboard', 'success');
    }).catch(err => {
        console.error('Failed to copy: ', err);
        showNotification('❌ Failed to copy to clipboard', 'error');
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.minWidth = '300px';
    notification.style.boxShadow = '0 5px 20px rgba(0,0,0,0.15)';
    notification.style.borderRadius = '10px';
    notification.style.border = 'none';
    
    let icon = '';
    switch(type) {
        case 'success': icon = '✅'; break;
        case 'error': icon = '❌'; break;
        case 'warning': icon = '⚠️'; break;
        default: icon = 'ℹ️';
    }
    
    notification.innerHTML = `
        ${icon} ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function validateNumber(value, fieldName) {
    if (isNaN(value)) {
        throw new Error(`${fieldName} must be a valid number`);
    }
    return value;
}

function validatePositive(value, fieldName) {
    if (value <= 0) {
        throw new Error(`${fieldName} must be positive`);
    }
    return value;
}