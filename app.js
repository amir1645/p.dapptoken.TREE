// فقط تابع buildBinaryTree رو آپدیت می‌کنم - بقیه توابع مثل قبل

// ساختار درخت باینری کامل - بهینه‌شده برای موبایل
async function buildBinaryTree(rootId) {
    const tree = {};
    const queue = [];
    let processedCount = 0;
    const maxProcess = 500; // کاهش برای موبایل
    
    expandedNodes.add(rootId);
    
    // محاسبه فاصله‌ها بر اساس اندازه صفحه
    const isMobile = window.innerWidth <= 768;
    const baseSpacingMultiplier = isMobile ? 25 : 40;
    const levelHeight = isMobile ? 80 : 120;
    
    // اضافه کردن ریشه با موقعیت مرکزی
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
            
            // اگر expand شده، فرزندان را اضافه کن
            if (tree[id].expanded && hasChildren) {
                const baseSpacing = Math.pow(2, 5 - Math.min(level, 5)) * baseSpacingMultiplier;
                
                if (hasLeft) {
                    const leftX = x - baseSpacing;
                    const leftY = y + levelHeight;
                    queue.push({
                        id: directs.leftId,
                        level: level + 1,
                        parentId: id,
                        position: 'left',
                        x: leftX,
                        y: leftY
                    });
                }
                
                if (hasRight) {
                    const rightX = x + baseSpacing;
                    const rightY = y + levelHeight;
                    queue.push({
                        id: directs.rightId,
                        level: level + 1,
                        parentId: id,
                        position: 'right',
                        x: rightX,
                        y: rightY
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
        
        if (processedCount % 3 === 0) {
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    }
    
    console.log(`✅ ${processedCount} کاربر پردازش شد (موبایل: ${isMobile})`);
    return tree;
}

// تابع رندر برای موبایل
function renderBinaryTree(treeStructure) {
    const treeElement = document.createElement('div');
    treeElement.className = 'binary-tree-container';
    
    // ایجاد SVG برای خطوط اتصال
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = 'tree-connections';
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '1';
    
    const nodesContainer = document.createElement('div');
    nodesContainer.className = 'binary-nodes-container';
    nodesContainer.style.position = 'relative';
    nodesContainer.style.zIndex = '2';
    nodesContainer.style.minHeight = '500px';
    nodesContainer.style.padding = '15px';
    
    // محاسبه offset برای وسط‌چین کردن
    const allNodes = Object.values(treeStructure);
    if (allNodes.length === 0) {
        treeContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">🌳</div><p>هیچ کاربری یافت نشد</p></div>';
        return;
    }
    
    const minX = Math.min(...allNodes.map(node => node.x));
    const maxX = Math.max(...allNodes.map(node => node.x));
    const minY = Math.min(...allNodes.map(node => node.y));
    const maxY = Math.max(...allNodes.map(node => node.y));
    
    const centerOffsetX = (minX + maxX) / 2;
    const centerOffsetY = Math.abs(minY) + 50;
    
    // محاسبه عرض مورد نیاز
    const requiredWidth = Math.max(800, (maxX - minX) + 200);
    nodesContainer.style.width = `${requiredWidth}px`;
    
    // ایجاد نودها و خطوط
    allNodes.forEach(node => {
        const finalX = node.x - centerOffsetX + (requiredWidth / 2);
        const finalY = node.y + centerOffsetY;
        
        // ایجاد خط اتصال به والد
        if (node.parentId && treeStructure[node.parentId]) {
            const parent = treeStructure[node.parentId];
            const parentX = parent.x - centerOffsetX + (requiredWidth / 2);
            const parentY = parent.y + centerOffsetY;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', parentX);
            line.setAttribute('y1', parentY + 35);
            line.setAttribute('x2', finalX);
            line.setAttribute('y2', finalY - 35);
            line.setAttribute('stroke', '#3b82f6');
            line.setAttribute('stroke-width', '3');
            line.setAttribute('class', 'connection-line');
            
            svg.appendChild(line);
        }
        
        // ایجاد نود
        const nodeElement = createBinaryNodeElement(node, finalX, finalY);
        nodesContainer.appendChild(nodeElement);
    });
    
    treeElement.appendChild(svg);
    treeElement.appendChild(nodesContainer);
    
    treeContainer.innerHTML = '';
    treeContainer.appendChild(treeElement);
    
    updateStats(treeStructure);
    
    // اضافه کردن راهنمای اسکرول برای موبایل
    if (window.innerWidth <= 768) {
        setTimeout(() => {
            const scrollHint = document.createElement('div');
            scrollHint.className = 'scroll-hint';
            scrollHint.innerHTML = '👈 اسکرول کنید 👉';
            scrollHint.style.cssText = `
                position: absolute;
                bottom: 10px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.8rem;
                z-index: 100;
                animation: bounce 2s infinite;
            `;
            treeElement.appendChild(scrollHint);
            
            // حذف راهنما بعد از 5 ثانیه
            setTimeout(() => {
                if (scrollHint.parentNode) {
                    scrollHint.parentNode.removeChild(scrollHint);
                }
            }, 5000);
        }, 1000);
    }
}