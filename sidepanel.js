class KeywordManager {
    constructor() {
        // 添加对实例的引用，以便在HTML中调用
        document.querySelector('.container').classList.add('KeywordManager');
        document.querySelector('.container').KeywordManager = this;

        this.initializeElements();
        this.bindEvents();
        this.loadKeywords();
    }

    // 初始化DOM元素
    initializeElements() {
        this.keywordInput = document.getElementById('keywordInput');
        this.saveButton = document.getElementById('saveKeyword');
        this.keywordList = document.getElementById('keywordList');
        this.tabs = document.querySelectorAll('.tab');
        this.analysisPanel = document.getElementById('analysisPanel');
        this.loading = document.getElementById('loading');
    }

    // 绑定事件
    bindEvents() {
        // 保存关键词
        this.saveButton.addEventListener('click', () => this.saveKeyword());
        this.keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveKeyword();
        });

        // 搜索功能
        this.keywordInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            this.filterKeywords(value);
        });

        // 标签切换
        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });
    }

    // 加载关键词列表
    async loadKeywords() {
        try {
            const result = await chrome.storage.sync.get(['keywords']);
            const keywords = result.keywords || [];
            this.renderKeywordList(keywords);
        } catch (error) {
            console.error('加载关键词失败:', error);
        }
    }

    // 保存关键词
    async saveKeyword() {
        const text = this.keywordInput.value.trim();
        if (!text) return;

        try {
            const result = await chrome.storage.sync.get(['keywords']);
            const keywords = result.keywords || [];
            
            // 检查是否已存在
            if (keywords.some(k => k.text === text)) {
                this.showNotification('该关键词已存在！');
                return;
            }

            // 添加新关键词
            const newKeyword = {
                id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                text: text,
                createTime: new Date().toISOString(),
                lastAnalyzedTime: null
            };

            // 将新关键词添加到数组开头，而不是末尾
            keywords.unshift(newKeyword);
            await chrome.storage.sync.set({ keywords });
            
            this.keywordInput.value = '';
            this.renderKeywordList(keywords);
            this.showNotification('关键词保存成功！');
        } catch (error) {
            console.error('保存关键词失败:', error);
            this.showNotification('保存失败，请重试');
        }
    }

    // 删除关键词
    async deleteKeyword(id) {
        try {
            const result = await chrome.storage.sync.get(['keywords']);
            const keywords = result.keywords || [];
            const updatedKeywords = keywords.filter(k => k.id !== id);
            await chrome.storage.sync.set({ keywords: updatedKeywords });
            await this.loadKeywords(); // 重新加载关键词列表
            this.showNotification('关键词已删除');
        } catch (error) {
            console.error('删除关键词失败:', error);
            console.error('完整错误:', error);
            console.error('关键词ID:', id);
            this.showNotification('删除失败，请重试');
        }
    }

    // 渲染关键词列表
    renderKeywordList(keywords) {
        this.keywordList.innerHTML = '';
        keywords.forEach((keyword, index) => {
            const item = document.createElement('div');
            item.className = 'keyword-item';
            item.draggable = true;
            item.dataset.id = keyword.id;
            item.dataset.index = index;
            item.innerHTML = `
                <span class="drag-handle material-icons">drag_indicator</span>
                <span class="keyword-text">${keyword.text}</span>
                <div class="keyword-actions">
                    <button class="btn btn-analyze btn-tooltip" title="分析搜索意图">
                        <span class="material-icons">psychology</span>
                    </button>
                    <button class="btn btn-trends btn-tooltip" title="查看Google趋势">
                        <span class="material-icons">trending_up</span>
                    </button>
                    <button class="btn btn-difficulty btn-tooltip" title="查看关键词难度">
                        <span class="material-icons">analytics</span>
                    </button>
                    <button class="btn btn-delete btn-tooltip" title="删除关键词">
                        <span class="material-icons">delete</span>
                    </button>
                </div>
            `;

            // 添加拖拽事件监听
            item.addEventListener('dragstart', (e) => this.handleDragStart(e));
            item.addEventListener('dragover', (e) => this.handleDragOver(e));
            item.addEventListener('drop', (e) => this.handleDrop(e));
            item.addEventListener('dragend', (e) => this.handleDragEnd(e));

            // 绑定按钮事件
            const analyzeBtn = item.querySelector('.btn-analyze');
            const deleteBtn = item.querySelector('.btn-delete');
            const trendsBtn = item.querySelector('.btn-trends');
            const difficultyBtn = item.querySelector('.btn-difficulty');
            
            analyzeBtn.addEventListener('click', () => this.analyzeKeyword(keyword));
            deleteBtn.addEventListener('click', async () => {
                try {
                    await this.deleteKeyword(keyword.id);
                } catch (error) {
                    console.error('删除按钮点击处理失败:', error);
                }
            });
            trendsBtn.addEventListener('click', () => {
                const encodedKeyword = encodeURIComponent(keyword.text);
                const trendsUrl = `https://trends.google.com/trends/explore?date=now%207-d&q=${encodedKeyword},gpts`;
                window.open(trendsUrl, '_blank');
            });
            difficultyBtn.addEventListener('click', () => {
                const encodedKeyword = encodeURIComponent(keyword.text);
                const difficultyUrl = `https://ahrefs.com/keyword-difficulty/?country=us&input=${encodedKeyword}`;
                window.open(difficultyUrl, '_blank');
            });

            this.keywordList.appendChild(item);
        });
    }

    // 拖拽相关方法
    handleDragStart(e) {
        e.target.classList.add('dragging');
        e.dataTransfer.setData('text/plain', e.target.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const draggedItem = this.keywordList.querySelector('.dragging');
        const currentItem = e.target.closest('.keyword-item');
        
        if (draggedItem && currentItem && draggedItem !== currentItem) {
            const rect = currentItem.getBoundingClientRect();
            const mid = (rect.bottom - rect.top) / 2;
            const mouseY = e.clientY - rect.top;
            
            if (mouseY < mid) {
                currentItem.parentNode.insertBefore(draggedItem, currentItem);
            } else {
                currentItem.parentNode.insertBefore(draggedItem, currentItem.nextSibling);
            }
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        
        // 获取新的排序
        const items = Array.from(this.keywordList.children);
        const newOrder = items.map(item => item.dataset.id);
        
        try {
            // 获取当前关键词列表
            const result = await chrome.storage.sync.get(['keywords']);
            let keywords = result.keywords || [];
            
            // 根据新顺序重排关键词
            keywords.sort((a, b) => {
                return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
            });
            
            // 保存新顺序
            await chrome.storage.sync.set({ keywords });
        } catch (error) {
            console.error('保存排序失败:', error);
            this.showNotification('排序保存失败，请重试');
        }
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        Array.from(this.keywordList.children).forEach(item => {
            item.classList.remove('drag-over');
        });
    }

    // 过滤关键词
    filterKeywords(searchText) {
        chrome.storage.sync.get(['keywords'], (result) => {
            const keywords = result.keywords || [];
            const filteredKeywords = keywords.filter(k => 
                k.text.toLowerCase().includes(searchText.toLowerCase())
            );
            this.renderKeywordList(filteredKeywords);
        });
    }

    // 切换标签
    switchTab(tabName) {
        this.tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        if (tabName === 'analysis') {
            this.analysisPanel.style.display = 'block';
            this.keywordList.style.display = 'none';
        } else {
            this.analysisPanel.style.display = 'none';
            this.keywordList.style.display = 'block';
        }
    }

    // 显示通知
    showNotification(message) {
        // 创建通知元素
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

        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateY(-20px)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // 使用 marked 渲染 Markdown
    markdownToHtml(text) {
        try {
            if (typeof marked === 'undefined') {
                console.error('Marked library is not loaded');
                return this.fallbackMarkdownToHtml(text);
            }

            marked.setOptions({
                gfm: true, // 启用 GitHub 风格的 Markdown
                breaks: true, // 启用换行符
                headerIds: false, // 禁用标题 ID
                mangle: false, // 禁用标题 ID 转义
                sanitize: false, // 允许 HTML 标签
            });
            return marked.parse(text);
        } catch (error) {
            console.error('Markdown parsing failed:', error);
            return this.fallbackMarkdownToHtml(text);
        }
    }

    // 后备的 Markdown 转换方法
    fallbackMarkdownToHtml(text) {
        // 简单的文本转换
        return text.split('\n').map(line => {
            if (line.startsWith('# ')) {
                return `<h1>${line.slice(2)}</h1>`;
            } else if (line.startsWith('## ')) {
                return `<h2>${line.slice(3)}</h2>`;
            } else if (line.startsWith('### ')) {
                return `<h3>${line.slice(4)}</h3>`;
            } else if (line.trim().length > 0) {
                return `<p>${line}</p>`;
            }
            return line;
        }).join('');
    }

    // 更新分析面板内容
    updateAnalysisContent(content) {
        const formattedContent = this.markdownToHtml(content);
        this.analysisPanel.innerHTML = `
            <div class="analysis-header">
                <h3>关键词："${this.currentKeyword.text}"的分析结果</h3>
                <button class="btn-copy" id="copyButton">
                    <span class="material-icons">content_copy</span>
                    复制结果
                </button>
            </div>
            <div class="analysis-content">
                ${formattedContent}
            </div>
        `;

        // 添加复制按钮事件监听
        const copyButton = this.analysisPanel.querySelector('#copyButton');
        copyButton.addEventListener('click', () => this.copyAnalysisResult());
    }

    // 复制分析结果
    async copyAnalysisResult() {
        try {
            // 获取分析内容，排除复制按钮
            const analysisContent = this.analysisPanel.querySelector('.analysis-content');
            const content = analysisContent.innerText;

            await navigator.clipboard.writeText(content);
            this.showNotification('分析结果已复制到剪贴板');
        } catch (error) {
            console.error('复制失败:', error);
            this.showNotification('复制失败，请重试');
        }
    }

    // 分析关键词
    async analyzeKeyword(keyword) {
        this.currentKeyword = keyword;
        this.switchTab('analysis');
        this.loading.classList.add('active');
        this.analysisPanel.innerHTML = `<p>正在分析「${keyword.text}」...</p>`;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'analyze',
                keyword: keyword.text
            });

            if (!response.success) {
                throw new Error(response.error || '分析失败');
            }

            this.updateAnalysisContent(response.result);

            // 更新关键词的分析时间
            const result = await chrome.storage.sync.get(['keywords']);
            const keywords = result.keywords || [];
            const updatedKeywords = keywords.map(k => {
                if (k.id === keyword.id) {
                    return { ...k, lastAnalyzedTime: new Date().toISOString() };
                }
                return k;
            });
            await chrome.storage.sync.set({ keywords: updatedKeywords });
        } catch (error) {
            this.analysisPanel.innerHTML = `
                <div class="error-message">
                    <h4>分析失败</h4>
                    <p>${error.message}</p>
                    <button class="btn btn-retry" onclick="location.reload()">重试</button>
                </div>
            `;
        } finally {
            this.loading.classList.remove('active');
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new KeywordManager();
});

// 监听存储变化和分析更新
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'keywordsUpdated') {
        const keywordManager = new KeywordManager();
        keywordManager.loadKeywords();
    } else if (message.type === 'analysisUpdate') {
        const keywordManager = new KeywordManager();
        keywordManager.updateAnalysisContent(message.content);
    }
}); 