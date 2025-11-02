// 全局状态
let currentUser = null;
let currentToken = null;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 检查本地存储中的用户信息
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');
    
    if (savedUser && savedToken) {
        currentUser = JSON.parse(savedUser);
        currentToken = savedToken;
        updateUserInterface();
    }
    
    // 初始化事件监听
    initializeEventListeners();
    
    // 初始化拖拽功能
    initializeDragAndDrop();
    
    // 加载保存的层级排列
    loadTierPositions();
});

// 初始化事件监听
function initializeEventListeners() {
    // 登录/注册切换
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    // 登录表单
    const loginForm = document.getElementById('login');
    loginForm.addEventListener('submit', handleLogin);
    
    // 注册表单
    const registerForm = document.getElementById('register');
    registerForm.addEventListener('submit', handleRegister);
}

// 初始化拖拽功能
function initializeDragAndDrop() {
    const tierItems = document.querySelectorAll('.tier-item');
    const tierContents = document.querySelectorAll('.tier-content');
    const unrankedContainer = document.getElementById('unranked-items');
    
    // 为每个项目添加拖拽事件
    tierItems.forEach(item => {
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragend', handleDragEnd);
    });
    
    // 为每个层级容器添加放置事件
    tierContents.forEach(container => {
        container.addEventListener('dragover', handleDragOver);
        container.addEventListener('drop', handleDrop);
        container.addEventListener('dragenter', handleDragEnter);
        container.addEventListener('dragleave', handleDragLeave);
    });
    
    // 为待评价区域添加放置事件
    unrankedContainer.addEventListener('dragover', handleDragOver);
    unrankedContainer.addEventListener('drop', handleDropToUnranked);
    unrankedContainer.addEventListener('dragenter', handleDragEnter);
    unrankedContainer.addEventListener('dragleave', handleDragLeave);
}

// 拖拽开始
function handleDragStart(e) {
    const item = e.target;
    item.classList.add('dragging');
    
    // 设置拖拽数据
    e.dataTransfer.setData('text/plain', item.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // 添加视觉反馈
    setTimeout(() => {
        item.style.opacity = '0.5';
    }, 0);
}

// 拖拽结束
function handleDragEnd(e) {
    const item = e.target;
    item.classList.remove('dragging');
    item.style.opacity = '1';
    
    // 移除所有悬停状态
    document.querySelectorAll('.tier-content').forEach(container => {
        container.classList.remove('drag-over');
    });
    document.getElementById('unranked-items').classList.remove('drag-over');
}

// 拖拽悬停
function handleDragOver(e) {
    e.preventDefault(); // 允许放置
    e.dataTransfer.dropEffect = 'move';
}

// 进入放置区域
function handleDragEnter(e) {
    e.preventDefault();
    const container = e.target.closest('.tier-content');
    if (container) {
        container.classList.add('drag-over');
    }
}

// 离开放置区域
function handleDragLeave(e) {
    const container = e.target.closest('.tier-content');
    if (container && !container.contains(e.relatedTarget)) {
        container.classList.remove('drag-over');
    }
}

// 放置到层级
function handleDrop(e) {
    e.preventDefault();
    const container = e.target.closest('.tier-content');
    if (!container) return;
    
    const itemId = e.dataTransfer.getData('text/plain');
    const item = document.querySelector(`[data-id="${itemId}"]`);
    
    if (item && container) {
        // 移除拖拽时的样式
        item.classList.remove('dragging');
        item.style.opacity = '1';
        
        // 移动到新的层级
        container.appendChild(item);
        
        // 移除悬停状态
        container.classList.remove('drag-over');
        
        // 保存位置信息
        saveTierPositions();
        
        // 显示提示
        const tierName = container.dataset.tier;
        showToast(`项目已移动到 ${getTierName(tierName)} 层级`, 'success');
    }
}

// 放置到待评价区域
function handleDropToUnranked(e) {
    e.preventDefault();
    const container = e.target.closest('#unranked-items');
    if (!container) return;
    
    const itemId = e.dataTransfer.getData('text/plain');
    const item = document.querySelector(`[data-id="${itemId}"]`);
    
    if (item && container) {
        // 移除拖拽时的样式
        item.classList.remove('dragging');
        item.style.opacity = '1';
        
        // 移动到待评价区域
        container.appendChild(item);
        
        // 移除悬停状态
        container.classList.remove('drag-over');
        
        // 保存位置信息
        saveTierPositions();
        
        // 显示提示
        showToast('项目已移至待评价区域', 'info');
    }
}

// 获取层级中文名称
function getTierName(tierKey) {
    const tierNames = {
        's': '夯',
        'a': '顶级',
        'b': '人上人',
        'c': 'NPC',
        'd': '拉完了'
    };
    return tierNames[tierKey] || tierKey;
}

// 保存层级排列到本地存储
function saveTierPositions() {
    const tierPositions = {};
    
    // 保存所有层级中的项目
    document.querySelectorAll('.tier-content').forEach(container => {
        const tierKey = container.dataset.tier;
        const items = Array.from(container.querySelectorAll('.tier-item'))
            .map(item => item.dataset.id);
        tierPositions[tierKey] = items;
    });
    
    // 保存待评价项目
    const unrankedItems = Array.from(document.querySelectorAll('#unranked-items .tier-item'))
        .map(item => item.dataset.id);
    tierPositions.unranked = unrankedItems;
    
    // 保存到本地存储
    localStorage.setItem('tierPositions', JSON.stringify(tierPositions));
}

// 从本地存储加载层级排列
function loadTierPositions() {
    const saved = localStorage.getItem('tierPositions');
    if (!saved) return;
    
    try {
        const tierPositions = JSON.parse(saved);
        
        // 移动所有项目到正确的位置
        Object.keys(tierPositions).forEach(tierKey => {
            if (tierKey === 'unranked') {
                // 移动到待评价区域
                const container = document.getElementById('unranked-items');
                tierPositions[tierKey].forEach(itemId => {
                    const item = document.querySelector(`[data-id="${itemId}"]`);
                    if (item) {
                        container.appendChild(item);
                    }
                });
            } else {
                // 移动到指定层级
                const container = document.querySelector(`[data-tier="${tierKey}"]`);
                if (container) {
                    tierPositions[tierKey].forEach(itemId => {
                        const item = document.querySelector(`[data-id="${itemId}"]`);
                        if (item) {
                            container.appendChild(item);
                        }
                    });
                }
            }
        });
    } catch (error) {
        console.error('加载层级排列失败:', error);
    }
}

// 添加新项目
function addNewItem() {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    const title = prompt('请输入项目名称:');
    if (!title) return;
    
    const itemId = 'item_' + Date.now();
    const newItem = document.createElement('div');
    newItem.className = 'tier-item';
    newItem.setAttribute('draggable', 'true');
    newItem.dataset.id = itemId;
    newItem.innerHTML = `<span>${escapeHtml(title)}</span>`;
    
    // 添加拖拽事件
    newItem.addEventListener('dragstart', handleDragStart);
    newItem.addEventListener('dragend', handleDragEnd);
    
    // 添加到待评价区域
    document.getElementById('unranked-items').appendChild(newItem);
    
    // 保存位置
    saveTierPositions();
    
    showToast('新项目已添加到待评价区域', 'success');
}

// 切换登录/注册标签
function switchTab(targetTab) {
    // 更新标签状态
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === targetTab) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // 更新表单状态
    const forms = document.querySelectorAll('.form-container');
    forms.forEach(form => {
        if (form.id === targetTab + 'Form') {
            form.classList.add('active');
        } else {
            form.classList.remove('active');
        }
    });
    
    // 清除错误消息
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerError').textContent = '';
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        showLoading();
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            currentToken = data.token;
            
            // 保存到本地存储
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            
            updateUserInterface();
            hideAuthModal();
            showToast('登录成功！', 'success');
        } else {
            document.getElementById('loginError').textContent = data.error || '登录失败';
        }
    } catch (error) {
        console.error('登录错误:', error);
        document.getElementById('loginError').textContent = '网络错误，请稍后重试';
    } finally {
        hideLoading();
    }
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();
    
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
        showLoading();
        
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            currentToken = data.token;
            
            // 保存到本地存储
            localStorage.setItem('user', JSON.stringify(data.user));
            localStorage.setItem('token', data.token);
            
            updateUserInterface();
            hideAuthModal();
            showToast('注册成功！', 'success');
        } else {
            document.getElementById('registerError').textContent = data.error || '注册失败';
        }
    } catch (error) {
        console.error('注册错误:', error);
        document.getElementById('registerError').textContent = '网络错误，请稍后重试';
    } finally {
        hideLoading();
    }
}

// 更新用户界面
function updateUserInterface() {
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');
    
    if (currentUser) {
        userInfo.style.display = 'flex';
        username.textContent = currentUser.username;
    } else {
        userInfo.style.display = 'none';
    }
}

// 退出登录
function logout() {
    currentUser = null;
    currentToken = null;
    
    // 清除本地存储
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    updateUserInterface();
    showAuthModal();
    showToast('已退出登录', 'info');
}

// 显示认证模态框
function showAuthModal() {
    document.getElementById('authModal').classList.add('show');
}

// 隐藏认证模态框
function hideAuthModal() {
    document.getElementById('authModal').classList.remove('show');
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 工具函数
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 点击模态框外部关闭
document.addEventListener('click', function(e) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
});

// 按ESC键关闭模态框
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.classList.remove('show');
        });
    }
});

// 如果用户未登录，显示认证模态框
if (!currentUser) {
    setTimeout(() => {
        showAuthModal();
    }, 500);
}