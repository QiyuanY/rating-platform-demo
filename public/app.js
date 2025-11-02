// 全局状态
let currentUser = null;
let currentToken = null;
let currentContentId = null;
let currentCategory = 'all';

// 评价等级配置
const RATING_LEVELS = {
    'lā': { score: 1, name: '拉', description: '表现较差' },
    'hāng': { score: 2, name: '夯', description: '基础水平' },
    'zhōng': { score: 3, name: '中', description: '平均水平' },
    'shàng': { score: 4, name: '上', description: '较好表现' },
    'jiā': { score: 5, name: '佳', description: '优秀水平' },
    'rénshàng': { score: 6, name: '人上', description: '超越大多数' },
    'dǐng': { score: 7, name: '顶', description: '顶级表现' }
};

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
    
    // 加载统计数据
    loadStats();
    
    // 加载内容列表
    loadContents();
    
    // 初始化评价等级按钮
    initializeRatingLevels();
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
    
    // 分类筛选
    const categoryTabs = document.querySelectorAll('.category-tab');
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const category = this.getAttribute('data-category');
            filterByCategory(category);
        });
    });
    
    // 评价表单
    const ratingForm = document.getElementById('ratingForm');
    ratingForm.addEventListener('submit', handleRatingSubmit);
    
    // 创建内容表单
    const createContentForm = document.getElementById('createContentForm');
    createContentForm.addEventListener('submit', handleCreateContent);
    
    // 标签输入
    const tagInput = document.getElementById('tagInput');
    tagInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(this.value.trim());
            this.value = '';
        }
    });
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
            
            // 重新加载内容列表
            loadContents();
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
            
            // 重新加载内容列表
            loadContents();
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

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
        document.getElementById('totalContents').textContent = stats.totalContents || 0;
        document.getElementById('totalRatings').textContent = stats.totalRatings || 0;
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 加载内容列表
async function loadContents() {
    try {
        showLoading();
        
        const url = currentCategory === 'all' 
            ? '/api/contents' 
            : `/api/contents?category=${currentCategory}`;
        
        const response = await fetch(url);
        const contents = await response.json();
        
        renderContents(contents);
    } catch (error) {
        console.error('加载内容失败:', error);
        showToast('加载内容失败', 'error');
    } finally {
        hideLoading();
    }
}

// 渲染内容列表
function renderContents(contents) {
    const contentList = document.getElementById('contentList');
    
    if (contents.length === 0) {
        contentList.innerHTML = '<p style="color: white; text-align: center; font-size: 1.2rem;">暂无内容</p>';
        return;
    }
    
    contentList.innerHTML = contents.map(content => {
        const stats = content.stats || { total_ratings: 0, average_score: 0 };
        const distribution = JSON.parse(stats.level_distribution || '{}');
        
        return `
            <div class="content-card" onclick="openRatingModal('${content.id}', '${content.title}')">
                <div class="content-header">
                    <div>
                        <div class="content-title">${escapeHtml(content.title)}</div>
                        <span class="content-category">${getCategoryName(content.category)}</span>
                    </div>
                </div>
                <div class="content-description">${escapeHtml(content.description || '')}</div>
                <div class="content-meta">
                    <div class="content-rating">
                        <i class="fas fa-star"></i>
                        <span class="rating-score">${stats.average_score.toFixed(1)}</span>
                        <span class="rating-count">(${stats.total_ratings}人评价)</span>
                    </div>
                    <div class="content-creator">
                        by ${escapeHtml(content.creator_name || '匿名')}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 按分类筛选
function filterByCategory(category) {
    // 更新分类标签状态
    const categoryTabs = document.querySelectorAll('.category-tab');
    categoryTabs.forEach(tab => {
        if (tab.getAttribute('data-category') === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    currentCategory = category;
    loadContents();
}

// 获取分类中文名称
function getCategoryName(category) {
    const categoryNames = {
        'game': '游戏',
        'movie': '影视',
        'music': '音乐',
        'book': '文学',
        'food': '美食',
        'tech': '科技'
    };
    return categoryNames[category] || category;
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初始化评价等级按钮
function initializeRatingLevels() {
    const ratingCategories = ['overallLevels', 'technicalLevels', 'creativityLevels', 'executionLevels', 'impactLevels'];
    
    ratingCategories.forEach(categoryId => {
        const container = document.getElementById(categoryId);
        container.innerHTML = '';
        
        Object.keys(RATING_LEVELS).forEach(levelKey => {
            const level = RATING_LEVELS[levelKey];
            const button = document.createElement('button');
            button.className = `rating-level level-${levelKey}`;
            button.textContent = `${level.name} - ${level.description}`;
            button.setAttribute('data-level', levelKey);
            button.onclick = () => selectRatingLevel(categoryId, levelKey);
            container.appendChild(button);
        });
    });
}

// 选择评价等级
function selectRatingLevel(categoryId, levelKey) {
    const container = document.getElementById(categoryId);
    const buttons = container.querySelectorAll('.rating-level');
    
    // 清除之前的选择
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    // 选择当前等级
    const selectedButton = container.querySelector(`[data-level="${levelKey}"]`);
    selectedButton.classList.add('selected');
    
    // 保存到表单数据
    const formData = getFormData();
    const fieldName = categoryId.replace('Levels', '_level').replace('overall', 'overall');
    formData[fieldName] = levelKey;
    setFormData(formData);
}

// 打开评价模态框
function openRatingModal(contentId, title) {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    currentContentId = contentId;
    document.getElementById('modalTitle').textContent = `评价 - ${title}`;
    document.getElementById('ratingModal').classList.add('show');
    
    // 清除之前的评价
    clearRatingForm();
    
    // 加载现有评价
    loadExistingRatings(contentId);
}

// 关闭评价模态框
function closeRatingModal() {
    document.getElementById('ratingModal').classList.remove('show');
    currentContentId = null;
}

// 清除评价表单
function clearRatingForm() {
    // 重置所有等级选择
    const allLevelButtons = document.querySelectorAll('.rating-level');
    allLevelButtons.forEach(btn => btn.classList.remove('selected'));
    
    // 清除文本内容
    document.getElementById('ratingComment').value = '';
    
    // 清除标签
    document.getElementById('tagsContainer').innerHTML = '';
    
    // 重置表单数据
    setFormData({});
}

// 加载现有评价
async function loadExistingRatings(contentId) {
    try {
        const response = await fetch(`/api/contents/${contentId}/ratings`);
        const ratings = await response.json();
        
        const existingRatingsDiv = document.getElementById('existingRatings');
        
        if (ratings.length === 0) {
            existingRatingsDiv.innerHTML = '<p style="text-align: center; color: #666; margin-top: 2rem;">暂无评价</p>';
            return;
        }
        
        existingRatingsDiv.innerHTML = `
            <h3>已有评价 (${ratings.length})</h3>
            ${ratings.map(rating => `
                <div class="rating-item">
                    <div class="rating-header">
                        <span class="rating-user">${escapeHtml(rating.username)}</span>
                        <span class="rating-date">${new Date(rating.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="rating-levels-display">
                        ${renderRatingLevel('总体', rating.overall_level)}
                        ${rating.technical_level ? renderRatingLevel('技术', rating.technical_level) : ''}
                        ${rating.creativity_level ? renderRatingLevel('创意', rating.creativity_level) : ''}
                        ${rating.execution_level ? renderRatingLevel('执行', rating.execution_level) : ''}
                        ${rating.impact_level ? renderRatingLevel('影响', rating.impact_level) : ''}
                    </div>
                    ${rating.comment ? `<div class="rating-comment">${escapeHtml(rating.comment)}</div>` : ''}
                    ${rating.tags && rating.tags.length > 0 ? `
                        <div class="rating-tags">
                            ${rating.tags.map(tag => `<span class="rating-tag">${escapeHtml(tag)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        `;
    } catch (error) {
        console.error('加载评价失败:', error);
    }
}

// 渲染评价等级显示
function renderRatingLevel(label, levelKey) {
    const level = RATING_LEVELS[levelKey];
    if (!level) return '';
    
    return `<span class="rating-level-display level-${levelKey}">${label}: ${level.name}</span>`;
}

// 处理评价提交
async function handleRatingSubmit(e) {
    e.preventDefault();
    
    if (!currentContentId) {
        showToast('内容信息缺失', 'error');
        return;
    }
    
    const formData = getFormData();
    
    if (!formData.overall_level) {
        showToast('请选择总体评价', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/ratings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                content_id: currentContentId,
                overall_level: formData.overall_level,
                technical_level: formData.technical_level,
                creativity_level: formData.creativity_level,
                execution_level: formData.execution_level,
                impact_level: formData.impact_level,
                comment: document.getElementById('ratingComment').value.trim(),
                tags: getCurrentTags()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('评价提交成功！', 'success');
            closeRatingModal();
            
            // 重新加载内容列表和统计数据
            loadContents();
            loadStats();
        } else {
            showToast(data.error || '评价提交失败', 'error');
        }
    } catch (error) {
        console.error('提交评价失败:', error);
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
}

// 表单数据管理
let formData = {};

function getFormData() {
    return formData;
}

function setFormData(data) {
    formData = { ...formData, ...data };
}

// 标签管理
let currentTags = [];

function addTag(tagText) {
    if (!tagText || currentTags.includes(tagText)) return;
    
    currentTags.push(tagText);
    
    const tagElement = document.createElement('span');
    tagElement.className = 'tag';
    tagElement.innerHTML = `
        ${escapeHtml(tagText)}
        <span class="remove" onclick="removeTag('${tagText}')">&times;</span>
    `;
    
    document.getElementById('tagsContainer').appendChild(tagElement);
}

function removeTag(tagText) {
    currentTags = currentTags.filter(tag => tag !== tagText);
    
    // 移除对应的DOM元素
    const tagsContainer = document.getElementById('tagsContainer');
    const tags = tagsContainer.querySelectorAll('.tag');
    tags.forEach(tag => {
        if (tag.textContent.includes(tagText)) {
            tagsContainer.removeChild(tag);
        }
    });
}

function getCurrentTags() {
    return currentTags;
}

// 打开创建内容模态框
function openCreateModal() {
    if (!currentUser) {
        showAuthModal();
        return;
    }
    
    document.getElementById('createModal').classList.add('show');
    document.getElementById('createContentForm').reset();
}

// 关闭创建内容模态框
function closeCreateModal() {
    document.getElementById('createModal').classList.remove('show');
}

// 处理创建内容
async function handleCreateContent(e) {
    e.preventDefault();
    
    const title = document.getElementById('contentTitle').value.trim();
    const category = document.getElementById('contentCategory').value;
    const description = document.getElementById('contentDescription').value.trim();
    const imageUrl = document.getElementById('contentImage').value.trim();
    
    if (!title || !category) {
        showToast('请填写必要信息', 'warning');
        return;
    }
    
    try {
        showLoading();
        
        const response = await fetch('/api/contents', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                title,
                category,
                description,
                image_url: imageUrl
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('内容创建成功！', 'success');
            closeCreateModal();
            
            // 重新加载内容列表和统计数据
            loadContents();
            loadStats();
        } else {
            showToast(data.error || '创建失败', 'error');
        }
    } catch (error) {
        console.error('创建内容失败:', error);
        showToast('网络错误，请稍后重试', 'error');
    } finally {
        hideLoading();
    }
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
    showAuthModal();
}