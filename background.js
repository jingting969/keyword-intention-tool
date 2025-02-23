// 监听扩展安装事件
chrome.runtime.onInstalled.addListener(() => {
    // 初始化存储
    chrome.storage.sync.get(['keywords'], (result) => {
        if (!result.keywords) {
            chrome.storage.sync.set({ keywords: [] });
        }
    });

    // 创建右键菜单
    chrome.contextMenus.create({
        id: "saveKeyword",
        title: "保存为关键词",
        contexts: ["selection"]  // 只在有文本选中时显示
    });

    // 启用侧边栏
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// 监听右键菜单点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "saveKeyword") {
        const selectedText = info.selectionText.trim();
        
        // 保存关键词
        chrome.storage.sync.get(['keywords'], (result) => {
            const keywords = result.keywords || [];
            
            // 检查是否已存在
            if (keywords.some(k => k.text === selectedText)) {
                // 通知用户关键词已存在
                chrome.tabs.sendMessage(tab.id, {
                    action: "showNotification",
                    message: "该关键词已存在！"
                });
                return;
            }

            // 添加新关键词
            const newKeyword = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                text: selectedText,
                createTime: new Date().toISOString(),
                lastAnalyzedTime: null
            };

            keywords.push(newKeyword);
            chrome.storage.sync.set({ keywords }, () => {
                // 通知用户保存成功
                chrome.tabs.sendMessage(tab.id, {
                    action: "showNotification",
                    message: "关键词保存成功！"
                });
                // 刷新侧边栏的关键词列表
                chrome.runtime.sendMessage({
                    type: 'keywordsUpdated'
                });
            });
        });
    }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'analyze') {
        const keyword = request.keyword;
        analyzeKeyword(keyword).then(result => {
            sendResponse({ success: true, result });
        }).catch(error => {
            console.error('分析失败:', error);
            sendResponse({ success: false, error: error.message });
        });
        return true; // 保持消息通道开启
    }
    return true;
});

// AI分析功能
async function analyzeKeyword(keyword) {
    const API_KEY = 'sk-zk2d424e40a4a8445848b5cd4440b1141b567baa81a33edd';
    const API_URL = 'https://api.zhizengzeng.com/v1/chat/completions';
    
    console.log('开始分析关键词:', keyword);
    
    const prompt = `你现在是一名独立开发者，想通过搜索关键词来开发产品，你需要告诉我用户的潜在搜索意图以及开发者可切入的方向。

关键词：${keyword}

请从以下几个方面进行分析：
1. 用户搜索意图分析
2. 市场机会分析
3. 可能的产品方向
4. 开发建议
`;

    try {
        console.log('发送API请求...');
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你是一个专业的产品分析师和独立开发者顾问。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status}, ${errorText}`);
        }

        const reader = response.body.getReader();
        let content = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // 解码响应数据
            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices[0].delta.content) {
                            content += parsed.choices[0].delta.content;
                            // 发送部分内容更新
                            chrome.runtime.sendMessage({
                                type: 'analysisUpdate',
                                content: content
                            });
                        }
                    } catch (e) {
                        console.error('解析响应数据失败:', e);
                    }
                }
            }
        }

        return content;

    } catch (error) {
        console.error('API调用失败:', error.message);
        console.error('完整错误:', error);
        throw new Error('分析失败，请稍后重试: ' + error.message);
    }
}

// 监听扩展图标点击事件
// chrome.action.onClicked.addListener((tab) => {
//     // 打开侧边栏
//     chrome.sidePanel.open();
// }); 