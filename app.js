// Contract ABI
const CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getUserInfo",
        "outputs": [
            {"internalType": "uint256", "name": "id", "type": "uint256"},
            {"internalType": "uint256", "name": "uplineId", "type": "uint256"},
            {"internalType": "uint256", "name": "leftCount", "type": "uint256"},
            {"internalType": "uint256", "name": "rightCount", "type": "uint256"},
            {"internalType": "uint256", "name": "saveLeft", "type": "uint256"},
            {"internalType": "uint256", "name": "saveRight", "type": "uint256"},
            {"internalType": "uint256", "name": "balanceCount", "type": "uint256"},
            {"internalType": "uint256", "name": "specialBalanceCount", "type": "uint256"},
            {"internalType": "uint256", "name": "totalMinerRewards", "type": "uint256"},
            {"internalType": "uint256", "name": "entryPrice", "type": "uint256"},
            {"internalType": "bool", "name": "isMiner", "type": "bool"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "userId", "type": "uint256"}],
        "name": "getUserDirects",
        "outputs": [
            {"internalType": "uint256", "name": "leftId", "type": "uint256"},
            {"internalType": "uint256", "name": "rightId", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

const CONTRACT_ADDRESS = "0x166dd205590240c90ca4e0e545ad69db47d8f22f";

// Global variables
let web3;
let contract;
let userAccount;
let userInfo = {};
let currentTree = {};
let expandedNodes = new Set();
let userDataCache = new Map();
let currentZoom = 1.0;
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

// DOM elements
const connectWalletBtn = document.getElementById('connectWallet');
const walletAddressSpan = document.getElementById('walletAddress');
const userInfoDiv = document.getElementById('userInfo');
const treeContainer = document.getElementById('treeContainer');
const userCountSpan = document.getElementById('userCount');
const networkDepthSpan = document.getElementById('networkDepth');
const expandAllBtn = document.getElementById('expandAll');
const collapseAllBtn = document.getElementById('collapseAll');
const refreshTreeBtn = document.getElementById('refreshTree');

// Initialize
window.addEventListener('load', async () => {
    console.log('🔧 Initializing application...');
    
    if (typeof window.ethereum !== 'undefined') {
        console.log('✅ MetaMask detected');
        web3 = new Web3(window.ethereum);
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        
        try {
            const accounts = await window.ethereum.request({ 
                method: 'eth_accounts' 
            });
            
            console.log('📋 Available accounts:', accounts);
            
            if (accounts.length > 0) {
                userAccount = accounts[0];
                console.log('👤 User account found:', userAccount);
                updateWalletUI();
                await loadUserInfo();
            } else {
                console.log('ℹ️ No connected accounts found');
                connectWalletBtn.disabled = false;
                connectWalletBtn.textContent = '🔗 اتصال کیف پول';
            }
        } catch (error) {
            console.error('❌ Error checking accounts:', error);
            showError('خطا در بررسی حساب‌های متصل');
        }

        // Event listeners
        expandAllBtn.addEventListener('click', expandAllNodes);
        collapseAllBtn.addEventListener('click', collapseAllNodes);
        refreshTreeBtn.addEventListener('click', refreshTree);
        
        // Ethereum events
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
        
    } else {
        console.log('❌ MetaMask not found');
        connectWalletBtn.disabled = true;
        connectWalletBtn.textContent = '⚠️ متامسک یافت نشد';
        walletAddressSpan.textContent = 'نصب متامسک ضروری است';
        showError('لطفاً MetaMask را نصب کنید');
    }
});

// نمایش خطا
function showError(message) {
    userInfoDiv.innerHTML = `<p class="error">❌ ${message}</p>`;
}

// مدیریت تغییر حساب
async function handleAccountsChanged(accounts) {
    console.log('🔄 Accounts changed:', accounts);
    
    if (accounts.length === 0) {
        userAccount = null;
        connectWalletBtn.textContent = '🔗 اتصال کیف پول';
        connectWalletBtn.disabled = false;
        walletAddressSpan.textContent = 'اتصال برقرار نشده';
        userInfoDiv.innerHTML = '<p>لطفاً کیف پول خود را متصل کنید</p>';
        treeContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🌳</div><p>پس از اتصال کیف پول، شبکه شما اینجا نمایش داده می‌شود</p></div>';
        userDataCache.clear();
    } else if (accounts[0] !== userAccount) {
        userAccount = accounts[0];
        userDataCache.clear();
        updateWalletUI();
        await loadUserInfo();
    }
}

function handleChainChanged(chainId) {
    console.log('🔗 Chain changed:', chainId);
    window.location.reload();
}

// Connect wallet
connectWalletBtn.addEventListener('click', async () => {
    console.log('🔄 Connect wallet clicked');
    
    try {
        connectWalletBtn.textContent = '⏳ در حال اتصال...';
        connectWalletBtn.disabled = true;
        
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        console.log('✅ Accounts access granted:', accounts);
        
        if (accounts.length === 0) {
            throw new Error('هیچ حسابی انتخاب نشد');
        }
        
        userAccount = accounts[0];
        
        updateWalletUI();
        await loadUserInfo();
        
    } catch (error) {
        console.error('❌ Error connecting wallet:', error);
        
        let errorMessage = 'خطا در اتصال کیف پول';
        
        if (error.code === 4001) {
            errorMessage = 'اتصال توسط کاربر لغو شد';
        } else if (error.code === -32002) {
            errorMessage = 'درخواست اتصال در حال انجام است';
        } else {
            errorMessage = error.message || 'خطای ناشناخته';
        }
        
        alert(`❌ ${errorMessage}`);
        connectWalletBtn.textContent = '🔗 اتصال کیف پول';
        connectWalletBtn.disabled = false;
    }
});

// Update wallet UI
function updateWalletUI() {
    if (!userAccount) {
        walletAddressSpan.textContent = 'اتصال برقرار نشده';
        connectWalletBtn.textContent = '🔗 اتصال کیف پول';
        connectWalletBtn.disabled = false;
        return;
    }
    
    const shortAddress = userAccount.substring(0, 6) + '...' + userAccount.substring(userAccount.length - 4);
    walletAddressSpan.textContent = shortAddress;
    connectWalletBtn.textContent = '✅ متصل شد';
    connectWalletBtn.disabled = true;
    
    console.log('✅ Wallet UI updated for:', shortAddress);
}

// Load user info
async function loadUserInfo() {
    try {
        console.log('📥 Loading user info for:', userAccount);
        
        if (!userAccount) {
            throw new Error('حساب کاربری تعریف نشده');
        }
        
        userInfoDiv.innerHTML = '<div class="loading">⏳ در حال بارگذاری اطلاعات کاربر...</div>';
        
        const result = await contract.methods.getUserInfo(userAccount).call();
        console.log('📊 User info result:', result);
        
        if (Number(result.id) === 0) {
            userInfoDiv.innerHTML = `
                <div class="info-item">
                    <span class="info-label">وضعیت:</span>
                    <span class="info-value">❌ کاربر ثبت نشده</span>
                </div>
                <div class="info-item">
                    <span class="info-label">راهنما:</span>
                    <span class="info-value">در سیستم ثبت نام کنید</span>
                </div>
            `;
            treeContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🔍</div><p>شما در سیستم ثبت نشده‌اید</p></div>';
            return;
        }
        
        userInfo = {
            id: Number(result.id),
            uplineId: Number(result.uplineId),
            leftCount: Number(result.leftCount),
            rightCount: Number(result.rightCount),
            saveLeft: Number(result.saveLeft),
            saveRight: Number(result.saveRight),
            balanceCount: Number(result.balanceCount),
            specialBalanceCount: Number(result.specialBalanceCount),
            totalMinerRewards: web3.utils.fromWei(result.totalMinerRewards, 'ether'),
            entryPrice: web3.utils.fromWei(result.entryPrice, 'ether'),
            isMiner: result.isMiner
        };
        
        console.log('✅ User info loaded:', userInfo);
        displayUserInfo();
        await loadNetwork();
        
    } catch (error) {
        console.error('❌ Error loading user info:', error);
        
        let errorMessage = 'خطا در بارگذاری اطلاعات کاربر';
        
        if (error.message.includes('execution reverted')) {
            errorMessage = 'قرارداد خطا داد - ممکن است کاربر ثبت نشده باشد';
        } else if (error.message.includes('Network Error')) {
            errorMessage = 'خطای شبکه - اتصال اینترنت را بررسی کنید';
        }
        
        userInfoDiv.innerHTML = `<p class="error">❌ ${errorMessage}</p>`;
        treeContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>خطا در بارگذاری اطلاعات</p></div>';
    }
}

// Display user info
function displayUserInfo() {
    userInfoDiv.innerHTML = `
        <div class="info-item">
            <span class="info-label">شناسه شما:</span>
            <span class="info-value">${userInfo.id}</span>
        </div>
        <div class="info-item">
            <span class="info-label">آپلاین:</span>
            <span class="info-value">${userInfo.uplineId}</span>
        </div>
        <div class="info-item">
            <span class="info-label">تعداد چپ:</span>
            <span class="info-value">${userInfo.leftCount}</span>
        </div>
        <div class="info-item">
            <span class="info-label">تعداد راست:</span>
            <span class="info-value">${userInfo.rightCount}</span>
        </div>
        <div class="info-item">
            <span class="info-label">ذخیره چپ:</span>
            <span class="info-value">${userInfo.saveLeft}</span>
        </div>
        <div class="info-item">
            <span class="info-label">ذخیره راست:</span>
            <span class="info-value">${userInfo.saveRight}</span>
        </div>
        <div class="info-item">
            <span class="info-label">بالانس:</span>
            <span class="info-value">${userInfo.balanceCount}</span>
        </div>
        <div class="info-item">
            <span class="info-label">پاداش ماینر:</span>
            <span class="info-value">${parseFloat(userInfo.totalMinerRewards).toFixed(2)} MATIC</span>
        </div>
        <div class="info-item">
            <span class="info-label">وضعیت:</span>
            <span class="info-value">${userInfo.isMiner ? '✅ ماینر' : '👤 کاربر'}</span>
        </div>
    `;
}

// تابع بهینه‌شده برای گرفتن اطلاعات کاربر با کش
async function getUserDirectsCached(userId) {
    const cacheKey = `directs_${userId}`;
    if (userDataCache.has(cacheKey)) {
        return userDataCache.get(cacheKey);
    }
    
    try {
        const directs = await contract.methods.getUserDirects(userId).call();
        const result = {
            leftId: Number(directs.leftId),
            rightId: Number(directs.rightId)
        };
        
        userDataCache.set(cacheKey, result);
        return result;
    } catch (error) {
        console.error(`Error loading directs for user ${userId}:`, error);
        return { leftId: 0, rightId: 0 };
    }
}

// ساختار درخت باینری با فاصله‌گذاری بهتر
async function buildBinaryTree(rootId) {
    const tree = {};
    const queue = [];
    let processedCount = 0;
    const maxProcess = 100;
    
    expandedNodes.add(rootId);
    
    // کاربر اصلی در مرکز
    queue.push({ 
        id: rootId, 
        level: 0, 
        parentId: null, 
        position: 'root',
        x: 0,
        y: 0
    });
    
    while (queue.length > 0 && processedCount < maxProcess) {
        const { id, level, parentId, position, x, y } = queue.shift();
        
        if (tree[id]) continue;
        
        try {
            const directs = await getUserDirectsCached(id);
            const hasLeft = directs.leftId > 0;
            const hasRight = directs.rightId > 0;
            const hasChildren = hasLeft || hasRight;
            
            tree[id] = {
                id: Number(id),
                parentId: parentId,
                position: position,
                leftId: directs.leftId,
                rightId: directs.rightId,
                isCurrentUser: id === userInfo.id,
                level: level,
                hasChildren: hasChildren,
                expanded: expandedNodes.has(id),
                x: x,
                y: y
            };
            
            processedCount++;
            
            if (tree[id].expanded && hasChildren) {
                // فاصله‌گذاری هوشمند بر اساس سطح
                const levelHeight = 150;
                const baseSpacing = Math.pow(2, 6 - Math.min(level, 6)) * 100;
                
                if (hasLeft) {
                    queue.push({
                        id: directs.leftId,
                        level: level + 1,
                        parentId: id,
                        position: 'left',
                        x: x - baseSpacing,
                        y: y + levelHeight
                    });
                }
                
                if (hasRight) {
                    queue.push({
                        id: directs.rightId,
                        level: level + 1,
                        parentId: id,
                        position: 'right',
                        x: x + baseSpacing,
                        y: y + levelHeight
                    });
                }
            }
            
        } catch (error) {
            console.error(`Error loading user ${id}:`, error);
            tree[id] = {
                id: Number(id),
                parentId: parentId,
                position: position,
                leftId: 0,
                rightId: 0,
                isCurrentUser: id === userInfo.id,
                level: level,
                hasChildren: false,
                expanded: false,
                error: true,
                x: x,
                y: y
            };
            processedCount++;
        }
    }
    
    console.log(`✅ ${processedCount} کاربر پردازش شد`);
    return tree;
}

// Load network
async function loadNetwork() {
    try {
        treeContainer.innerHTML = '<div class="loading">⏳ در حال بارگذاری شبکه...</div>';
        
        if (!userInfo.id) {
            throw new Error('اطلاعات کاربر لود نشده');
        }

        const treeStructure = await buildBinaryTree(userInfo.id);
        currentTree = treeStructure;
        
        renderBinaryTree(treeStructure);
        
    } catch (error) {
        console.error('Error loading network:', error);
        treeContainer.innerHTML = '<p class="error">❌ خطا در بارگذاری شبکه</p>';
    }
}

// رندر درخت باینری با زوم و خطوط درست
function renderBinaryTree(treeStructure) {
    // پاک کردن محتوای قبلی
    treeContainer.innerHTML = '';
    
    // ایجاد کانتینر اصلی
    const treeWrapper = document.createElement('div');
    treeWrapper.className = 'tree-wrapper';
    
    // اضافه کردن کنترل‌های زوم
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    zoomControls.innerHTML = `
        <button class="zoom-btn" id="zoomOut">−</button>
        <span class="zoom-level">${Math.round(currentZoom * 100)}%</span>
        <button class="zoom-btn" id="zoomIn">+</button>
        <button class="zoom-btn" id="resetZoom">⟳</button>
    `;
    treeWrapper.appendChild(zoomControls);
    
    // ایجاد کانتینر SVG برای خطوط
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-container';
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'tree-connections';
    
    // ایجاد کانتینر نودها
    const nodesContainer = document.createElement('div');
    nodesContainer.className = 'nodes-container';
    nodesContainer.style.transform = `scale(${currentZoom})`;
    nodesContainer.style.transformOrigin = 'center center';
    
    const allNodes = Object.values(treeStructure);
    if (allNodes.length === 0) {
        treeContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🌳</div><p>هیچ کاربری یافت نشد</p></div>';
        return;
    }
    
    // محاسبه ابعاد مورد نیاز
    const minX = Math.min(...allNodes.map(node => node.x));
    const maxX = Math.max(...allNodes.map(node => node.x));
    const minY = Math.min(...allNodes.map(node => node.y));
    const maxY = Math.max(...allNodes.map(node => node.y));
    
    const width = Math.max(2000, (maxX - minX) + 400);
    const height = Math.max(1200, (maxY - minY) + 400);
    
    // تنظیم ابعاد کانتینرها
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    nodesContainer.style.width = `${width}px`;
    nodesContainer.style.height = `${height}px`;
    
    const centerX = width / 2;
    const centerY = 100;
    
    // ایجاد خطوط اتصال
    allNodes.forEach(node => {
        if (node.parentId && treeStructure[node.parentId]) {
            const parent = treeStructure[node.parentId];
            
            // محاسبه موقعیت‌ها
            const parentX = parent.x - minX + 200;
            const parentY = parent.y - minY + 100;
            const nodeX = node.x - minX + 200;
            const nodeY = node.y - minY + 100;
            
            // ایجاد خط
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', parentX);
            line.setAttribute('y1', parentY + 35);
            line.setAttribute('x2', nodeX);
            line.setAttribute('y2', nodeY - 35);
            line.setAttribute('stroke', node.position === 'left' ? '#10b981' : '#f59e0b');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('class', 'connection-line');
            
            svg.appendChild(line);
        }
    });
    
    // ایجاد نودها
    allNodes.forEach(node => {
        const nodeX = node.x - minX + 200;
        const nodeY = node.y - minY + 100;
        
        const nodeElement = createBinaryNodeElement(node, nodeX, nodeY);
        nodesContainer.appendChild(nodeElement);
    });
    
    svgContainer.appendChild(svg);
    svgContainer.appendChild(nodesContainer);
    treeWrapper.appendChild(svgContainer);
    treeContainer.appendChild(treeWrapper);
    
    // اضافه کردن event listeners برای کنترل‌های زوم
    document.getElementById('zoomIn').addEventListener('click', () => {
        currentZoom = Math.min(2.0, currentZoom + 0.1);
        updateZoom();
    });
    
    document.getElementById('zoomOut').addEventListener('click', () => {
        currentZoom = Math.max(0.3, currentZoom - 0.1);
        updateZoom();
    });
    
    document.getElementById('resetZoom').addEventListener('click', () => {
        currentZoom = 1.0;
        updateZoom();
        // اسکرول به مرکز
        treeContainer.scrollLeft = (width * currentZoom - treeContainer.clientWidth) / 2;
        treeContainer.scrollTop = (height * currentZoom - treeContainer.clientHeight) / 2;
    });
    
    function updateZoom() {
        nodesContainer.style.transform = `scale(${currentZoom})`;
        document.querySelector('.zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
    }
    
    // اضافه کردن event listeners برای اسکرول با ماوس
    let isDragging = false;
    let startX, startY, scrollLeft, scrollTop;
    
    treeContainer.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.pageX - treeContainer.offsetLeft;
        startY = e.pageY - treeContainer.offsetTop;
        scrollLeft = treeContainer.scrollLeft;
        scrollTop = treeContainer.scrollTop;
        treeContainer.style.cursor = 'grabbing';
    });
    
    treeContainer.addEventListener('mouseleave', () => {
        isDragging = false;
        treeContainer.style.cursor = 'grab';
    });
    
    treeContainer.addEventListener('mouseup', () => {
        isDragging = false;
        treeContainer.style.cursor = 'grab';
    });
    
    treeContainer.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - treeContainer.offsetLeft;
        const y = e.pageY - treeContainer.offsetTop;
        const walkX = (x - startX) * 2;
        const walkY = (y - startY) * 2;
        treeContainer.scrollLeft = scrollLeft - walkX;
        treeContainer.scrollTop = scrollTop - walkY;
    });
    
    // اضافه کردن event listener برای اسکرول با چرخ ماوس
    treeContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = -e.deltaY * 0.01;
            currentZoom = Math.min(2.0, Math.max(0.3, currentZoom + delta));
            updateZoom();
        }
    });
    
    // اسکرول به مرکز در ابتدا
    setTimeout(() => {
        treeContainer.scrollLeft = (width * currentZoom - treeContainer.clientWidth) / 2;
        treeContainer.scrollTop = (height * currentZoom - treeContainer.clientHeight) / 2;
    }, 100);
    
    updateStats(treeStructure);
}

// ایجاد المان نود باینری
function createBinaryNodeElement(node, x, y) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'tree-node';
    nodeElement.style.left = `${x}px`;
    nodeElement.style.top = `${y}px`;
    nodeElement.style.transform = 'translate(-50%, -50%)';
    
    let nodeClasses = 'node';
    if (node.isCurrentUser) nodeClasses += ' current-user';
    if (node.expanded) nodeClasses += ' expanded';
    if (node.hasChildren && !node.expanded) nodeClasses += ' collapsed';
    if (node.position === 'left') nodeClasses += ' left-child';
    if (node.position === 'right') nodeClasses += ' right-child';
    
    const nodeDiv = document.createElement('div');
    nodeDiv.className = nodeClasses;
    
    const badges = [];
    if (node.isCurrentUser) badges.push('<span class="badge current-badge">شما</span>');
    if (node.hasChildren && !node.expanded) badges.push('<span class="badge expand-badge">+</span>');
    if (node.expanded) badges.push('<span class="badge expand-badge">−</span>');
    
    const uplineText = node.parentId ? node.parentId : '---';
    const leftText = node.leftId ? node.leftId : '---';
    const rightText = node.rightId ? node.rightId : '---';
    
    nodeDiv.innerHTML = `
        <div class="node-header">
            <div class="node-id">${node.id}</div>
            <div class="node-badges">${badges.join('')}</div>
        </div>
        <div class="node-info">
            <div class="info-line">
                <span class="info-label">آپ:</span>
                <span class="info-value">${uplineText}</span>
            </div>
            <div class="info-line">
                <span class="info-label">چپ:</span>
                <span class="info-value">${leftText}</span>
            </div>
            <div class="info-line">
                <span class="info-label">راست:</span>
                <span class="info-value">${rightText}</span>
            </div>
        </div>
    `;
    
    if (node.hasChildren) {
        nodeDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNodeExpansion(node.id);
        });
    }
    
    nodeElement.appendChild(nodeDiv);
    return nodeElement;
}

// toggle expansion نود
async function toggleNodeExpansion(nodeId) {
    if (expandedNodes.has(nodeId)) {
        expandedNodes.delete(nodeId);
    } else {
        expandedNodes.add(nodeId);
    }
    
    await reloadTree();
}

// باز کردن همه نودها
async function expandAllNodes() {
    Object.keys(currentTree).forEach(id => {
        if (currentTree[id].hasChildren) {
            expandedNodes.add(Number(id));
        }
    });
    
    await reloadTree();
}

// بستن همه نودها
async function collapseAllNodes() {
    expandedNodes.clear();
    expandedNodes.add(userInfo.id);
    
    await reloadTree();
}

// بروزرسانی درخت
async function refreshTree() {
    userDataCache.clear();
    await reloadTree();
}

// بارگذاری مجدد درخت
async function reloadTree() {
    try {
        treeContainer.innerHTML = '<div class="loading">⏳ در حال بروزرسانی...</div>';
        
        const treeStructure = await buildBinaryTree(userInfo.id);
        currentTree = treeStructure;
        
        renderBinaryTree(treeStructure);
        
    } catch (error) {
        console.error('Error reloading tree:', error);
        treeContainer.innerHTML = '<p class="error">❌ خطا در بروزرسانی</p>';
    }
}

// آپدیت آمار
function updateStats(treeStructure) {
    const userCount = Object.keys(treeStructure).length;
    const levels = new Set(Object.values(treeStructure).map(node => node.level));
    const networkDepth = levels.size;
    
    userCountSpan.textContent = userCount;
    networkDepthSpan.textContent = networkDepth;
}