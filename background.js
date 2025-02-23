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
    
    const prompt = `你现在是一名专业的网站开发顾问，需要基于用户的搜索关键词，分析可能的网站功能需求和开发建议。

关键词：${keyword}

请从以下几个方面进行分析：
1. 用户搜索目的分析
   - 用户通过这个关键词想要解决什么问题？
   - 用户在寻找什么类型的网站或功能？

2. 网站功能建议
   - 核心功能清单
   - 差异化功能建议
   - 用户体验要点
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
                    { role: 'system', content: '你是一个专业的网站开发顾问，擅长分析用户需求并提供具体的网站功能设计和技术实现建议。' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        console.log('API响应状态:', response.status);
        const responseText = await response.text();
        console.log('API响应内容:', responseText);

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}, ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`解析响应失败: ${e.message}, 原始响应: ${responseText}`);
        }

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error(`无效的API响应格式: ${JSON.stringify(data)}`);
        }

        return data.choices[0].message.content;
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