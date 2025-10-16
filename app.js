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
    if (typeof window.ethereum !== 'undefined') {
        web3 = new Web3(window.ethereum);
        contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
        
        try {
            const accounts = await window.ethereum.request({ 
                method: 'eth_accounts' 
            });
            
            if (accounts.length > 0) {
                userAccount = accounts[0];
                updateWalletUI();
                await loadUserInfo();
            } else {
                connectWalletBtn.disabled = false;
                connectWalletBtn.textContent = '🔗 اتصال کیف پول';
            }
        } catch (error) {
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

function handleChainChanged() {
    window.location.reload();
}

// Connect wallet
connectWalletBtn.addEventListener('click', async () => {
    try {
        connectWalletBtn.textContent = '⏳ در حال اتصال...';
        connectWalletBtn.disabled = true;
        
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        userAccount = accounts[0];
        updateWalletUI();
        await loadUserInfo();
        
    } catch (error) {
        alert('❌ خطا در اتصال کیف پول');
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
}

// Load user info
async function loadUserInfo() {
    try {
        userInfoDiv.innerHTML = '<div class="loading">⏳ در حال بارگذاری اطلاعات...</div>';
        
        const result = await contract.methods.getUserInfo(userAccount).call();
        
        if (Number(result.id) === 0) {
            userInfoDiv.innerHTML = `
                <div class="info-item">
                    <span class="info-label">وضعیت:</span>
                    <span class="info-value">❌ کاربر ثبت نشده</span>
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
        
        displayUserInfo();
        await loadNetwork();
        
    } catch (error) {
        userInfoDiv.innerHTML = `<p class="error">❌ خطا در بارگذاری اطلاعات کاربر</p>`;
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
        return { leftId: 0, rightId: 0 };
    }
}

// ساختار درخت باینری ساده
async function buildBinaryTree(rootId) {
    const tree = {};
    const queue = [];
    let processedCount = 0;
    const maxProcess = 50;
    
    expandedNodes.add(rootId);
    
    // کاربر اصلی در وسط
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
                // فاصله‌گذاری ساده
                const levelHeight = 100;
                const baseSpacing = Math.max(80, 200 / (level + 1));
                
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
        treeContainer.innerHTML = '<p class="error">❌ خطا در بارگذاری شبکه</p>';
    }
}

// رندر درخت باینری ساده
function renderBinaryTree(treeStructure) {
    treeContainer.innerHTML = '';
    
    const treeElement = document.createElement('div');
    treeElement.className = 'simple-tree';
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'tree-svg';
    
    const nodesContainer = document.createElement('div');
    nodesContainer.className = 'nodes-container';
    
    const allNodes = Object.values(treeStructure);
    if (allNodes.length === 0) {
        treeContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🌳</div><p>هیچ کاربری یافت نشد</p></div>';
        return;
    }
    
    // محاسبه ابعاد
    const minX = Math.min(...allNodes.map(node => node.x));
    const maxX = Math.max(...allNodes.map(node => node.x));
    const minY = Math.min(...allNodes.map(node => node.y));
    const maxY = Math.max(...allNodes.map(node => node.y));
    
    const width = Math.max(800, (maxX - minX) + 200);
    const height = Math.max(600, (maxY - minY) + 200);
    
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    nodesContainer.style.width = `${width}px`;
    nodesContainer.style.height = `${height}px`;
    
    // محاسبه زوم خودکار
    const containerWidth = treeContainer.clientWidth;
    const containerHeight = treeContainer.clientHeight;
    const scaleX = containerWidth / width;
    const scaleY = containerHeight / height;
    const autoZoom = Math.min(scaleX, scaleY, 1) * 0.9;
    
    nodesContainer.style.transform = `scale(${autoZoom})`;
    nodesContainer.style.transformOrigin = 'center center';
    
    // ایجاد خطوط
    allNodes.forEach(node => {
        if (node.parentId && treeStructure[node.parentId]) {
            const parent = treeStructure[node.parentId];
            
            const parentX = parent.x - minX + 100;
            const parentY = parent.y - minY + 100;
            const nodeX = node.x - minX + 100;
            const nodeY = node.y - minY + 100;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', parentX);
            line.setAttribute('y1', parentY + 25);
            line.setAttribute('x2', nodeX);
            line.setAttribute('y2', nodeY - 25);
            line.setAttribute('stroke', node.position === 'left' ? '#10b981' : '#f59e0b');
            line.setAttribute('stroke-width', '2');
            
            svg.appendChild(line);
        }
    });
    
    // ایجاد نودها
    allNodes.forEach(node => {
        const nodeX = node.x - minX + 100;
        const nodeY = node.y - minY + 100;
        
        const nodeElement = createSimpleNodeElement(node, nodeX, nodeY);
        nodesContainer.appendChild(nodeElement);
    });
    
    treeElement.appendChild(svg);
    treeElement.appendChild(nodesContainer);
    treeContainer.appendChild(treeElement);
    
    // اسکرول به مرکز
    setTimeout(() => {
        treeContainer.scrollLeft = (width * autoZoom - containerWidth) / 2;
        treeContainer.scrollTop = (height * autoZoom - containerHeight) / 2;
    }, 100);
    
    updateStats(treeStructure);
}

// ایجاد نود ساده
function createSimpleNodeElement(node, x, y) {
    const nodeElement = document.createElement('div');
    nodeElement.className = 'simple-node';
    nodeElement.style.left = `${x}px`;
    nodeElement.style.top = `${y}px`;
    
    let nodeClass = 'node-box';
    if (node.isCurrentUser) nodeClass += ' current';
    if (node.position === 'left') nodeClass += ' left';
    if (node.position === 'right') nodeClass += ' right';
    
    const badge = node.isCurrentUser ? '<div class="you-badge">شما</div>' : '';
    const expandIcon = node.hasChildren ? (node.expanded ? '−' : '+') : '';
    
    nodeElement.innerHTML = `
        <div class="${nodeClass}">
            ${badge}
            <div class="node-id">${node.id}</div>
            <div class="node-links">
                <span class="link">آپ: ${node.parentId || '---'}</span>
                <span class="link">چپ: ${node.leftId || '---'}</span>
                <span class="link">راست: ${node.rightId || '---'}</span>
            </div>
            ${expandIcon ? `<div class="expand-icon">${expandIcon}</div>` : ''}
        </div>
    `;
    
    if (node.hasChildren) {
        nodeElement.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleNodeExpansion(node.id);
        });
    }
    
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