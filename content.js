// 创建通知元素
function createNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background-color: #4CAF50;
        color: white;
        border-radius: 8px;
        z-index: 999999;
        font-family: Arial, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(-20px);
        display: flex;
        align-items: center;
        gap: 8px;
    `;

    // 添加成功图标
    const icon = document.createElement('span');
    icon.textContent = '✓';
    icon.style.cssText = `
        font-size: 18px;
        font-weight: bold;
    `;
    
    const text = document.createElement('span');
    text.textContent = message;
    
    notification.appendChild(icon);
    notification.appendChild(text);
    document.body.appendChild(notification);

    // 触发动画
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';
    });

    // 3秒后淡出并移除
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getSelectedText") {
        // 获取选中的文本
        const selectedText = window.getSelection().toString().trim();
        sendResponse({ text: selectedText });
    } else if (request.action === "showNotification") {
        createNotification(request.message);
    }
    return true;
});

// 监听右键菜单事件
document.addEventListener('contextmenu', (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        // 可以在这里添加一些额外的处理逻辑
        // 比如限制选中文本的长度等
    }
});

// 监听文本选择事件
document.addEventListener('mouseup', (event) => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText) {
        // 可以在这里添加一些额外的处理逻辑
        // 比如显示一个快捷操作按钮等
    }
}); 