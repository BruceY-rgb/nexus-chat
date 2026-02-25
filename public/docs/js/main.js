/**
 * Slack-like Chat API 文档 - 主要 JavaScript 功能
 */

// DOM 加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 等待 Prism.js 完成代码高亮
    setTimeout(function() {
        // 初始化所有功能（Prism.js之后）
        initCopyButtons();
        initSmoothScroll();
        initActiveNavigation();
        initMobileMenu();
        initCodeHighlight(); // 现在是安全的，不会破坏 Prism.js 的工作
        console.log('✅ API Documentation initialized successfully!');

        // 验证代码块显示 - 特别关注JavaScript高亮
        const codeBlocks = document.querySelectorAll('.code-block pre code');
        console.log('📦 Found ' + codeBlocks.length + ' code blocks');

        codeBlocks.forEach(function(block, index) {
            const text = block.textContent;
            const className = block.className;
            const hasTokenClasses = className.includes('token');
            const language = className.match(/language-(\w+)/)?.[1] || 'unknown';
            const hasHighlight = block.querySelectorAll('.token').length > 0;

            console.log(`\n📄 代码块 ${index + 1} [${language}]:`, {
                rawClassName: className,
                hasTokenClasses: hasTokenClasses,
                tokenElementCount: block.querySelectorAll('.token').length,
                hasPrismHighlight: hasHighlight,
                hasNewlines: text.includes('\n'),
                lineCount: text.split('\n').length,
                preview: text.substring(0, 50) + '...'
            });

            // 特别关注JavaScript代码块
            if (language === 'javascript' && !hasHighlight) {
                console.warn('⚠️ JavaScript 代码块缺少语法高亮！');
                console.warn('  可能原因:', [
                    '1. Prism.js版本不支持ES6+语法',
                    '2. 代码中包含未识别的语法',
                    '3. CSS样式覆盖了高亮效果'
                ]);
            }
        });
    }, 500); // 给 Prism.js 留出处理时间
});

/**
 * 复制代码功能
 */
function initCopyButtons() {
    const copyButtons = document.querySelectorAll('.copy-btn');

    copyButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const codeBlock = this.nextElementSibling;
            const code = codeBlock.textContent;

            try {
                await navigator.clipboard.writeText(code);

                // 显示成功反馈
                const originalText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-check"></i>';
                this.style.background = 'var(--success-color)';

                setTimeout(() => {
                    this.innerHTML = originalText;
                    this.style.background = 'rgba(0, 0, 0, 0.6)';
                }, 2000);

            } catch (err) {
                console.error('Failed to copy code:', err);
                // 降级方案：尝试使用现代 Clipboard API（某些浏览器支持）
                try {
                    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                        await navigator.clipboard.writeText(code);
                        alert('代码已复制到剪贴板');
                    } else {
                        // 最后的降级方案：选中文本
                        const range = document.createRange();
                        range.selectNode(codeBlock);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                        alert('请按 Ctrl/Cmd+C 复制代码');
                    }
                } catch (fallbackErr) {
                    console.error('Fallback copy also failed:', fallbackErr);
                    // 最简单的降级：选中文本
                    const range = document.createRange();
                    range.selectNode(codeBlock);
                    window.getSelection().removeAllRanges();
                    window.getSelection().addRange(range);
                    alert('请手动选择并复制代码');
                }
            }
        });
    });
}

/**
 * 平滑滚动功能
 */
function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');

    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // 忽略空锚点
            if (href === '#') {
                e.preventDefault();
                return;
            }

            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                e.preventDefault();

                // 计算目标位置，减去固定偏移量
                const targetPosition = targetElement.offsetTop - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // 更新 URL 但不滚动
                history.pushState(null, null, href);
            }
        });
    });
}

/**
 * 活跃导航高亮
 */
function initActiveNavigation() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav a[href^="#"]');

    function updateActiveNav() {
        const scrollPosition = window.scrollY + 100;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${sectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav(); // 初始调用
}

/**
 * 移动端菜单切换
 */
function initMobileMenu() {
    // 创建移动端菜单按钮
    const sidebar = document.querySelector('.sidebar');
    const menuButton = document.createElement('button');
    menuButton.className = 'mobile-menu-btn';
    menuButton.innerHTML = '<i class="fas fa-bars"></i>';
    menuButton.style.cssText = `
        display: none;
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1001;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        font-size: 20px;
        cursor: pointer;
        box-shadow: var(--shadow);
    `;

    document.body.appendChild(menuButton);

    // 显示/隐藏侧边栏
    menuButton.addEventListener('click', function() {
        sidebar.classList.toggle('active');
        const isActive = sidebar.classList.contains('active');
        this.innerHTML = isActive ?
            '<i class="fas fa-times"></i>' :
            '<i class="fas fa-bars"></i>';
    });

    // 点击侧边栏外部关闭菜单
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuButton.contains(e.target)) {
                sidebar.classList.remove('active');
                menuButton.innerHTML = '<i class="fas fa-bars"></i>';
            }
        }
    });

    // 响应式显示菜单按钮
    function handleResize() {
        if (window.innerWidth <= 768) {
            menuButton.style.display = 'block';
        } else {
            menuButton.style.display = 'none';
            sidebar.classList.remove('active');
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // 初始调用
}

/**
 * 代码高亮增强 - 保持原始格式
 */
function initCodeHighlight() {
    // 移除破坏代码格式的行号功能
    // 保留代码块的原始空白符和缩进
    // 不对代码块进行任何 DOM 操作，保持原始格式
}

/**
 * 工具函数：防抖
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 工具函数：节流
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 搜索功能（如果需要）
 */
function initSearch() {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索 API...';
    searchInput.className = 'search-input';
    searchInput.style.cssText = `
        width: 100%;
        padding: 10px;
        margin-bottom: 20px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        font-size: 14px;
    `;

    const searchContainer = document.querySelector('.nav-section');
    if (searchContainer) {
        searchContainer.insertBefore(searchInput, searchContainer.firstChild);
    }

    searchInput.addEventListener('input', debounce(function() {
        const searchTerm = this.value.toLowerCase();
        const sections = document.querySelectorAll('section');

        sections.forEach(section => {
            const text = section.textContent.toLowerCase();
            const isMatch = text.includes(searchTerm);

            if (isMatch || searchTerm === '') {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
    }, 300));
}

/**
 * 返回顶部按钮
 */
function initBackToTop() {
    const backToTopButton = document.createElement('button');
    backToTopButton.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopButton.className = 'back-to-top';
    backToTopButton.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        box-shadow: var(--shadow);
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 999;
    `;

    document.body.appendChild(backToTopButton);

    // 显示/隐藏按钮
    window.addEventListener('scroll', throttle(function() {
        if (window.scrollY > 300) {
            backToTopButton.style.opacity = '1';
            backToTopButton.style.visibility = 'visible';
        } else {
            backToTopButton.style.opacity = '0';
            backToTopButton.style.visibility = 'hidden';
        }
    }, 100));

    // 点击返回顶部
    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// 初始化返回顶部按钮
initBackToTop();

/**
 * 主题切换功能（如果需要）
 */
function initThemeToggle() {
    const themeToggleButton = document.createElement('button');
    themeToggleButton.innerHTML = '<i class="fas fa-moon"></i>';
    themeToggleButton.className = 'theme-toggle';
    themeToggleButton.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        background: var(--primary-color);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        box-shadow: var(--shadow);
        z-index: 1000;
        transition: all 0.3s ease;
    `;

    document.body.appendChild(themeToggleButton);

    // 检查本地存储中的主题
    const currentTheme = localStorage.getItem('theme') || 'light';
    if (currentTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeToggleButton.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // 切换主题
    themeToggleButton.addEventListener('click', function() {
        document.body.classList.toggle('dark-theme');

        if (document.body.classList.contains('dark-theme')) {
            this.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        } else {
            this.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        }
    });
}

// 可选：启用主题切换
// initThemeToggle();

/**
 * 打印功能
 */
function initPrintButton() {
    const printButton = document.createElement('button');
    printButton.innerHTML = '<i class="fas fa-print"></i>';
    printButton.className = 'print-btn';
    printButton.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 30px;
        width: 50px;
        height: 50px;
        background: var(--secondary-color);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 20px;
        cursor: pointer;
        box-shadow: var(--shadow);
        transition: all 0.3s ease;
        z-index: 999;
    `;

    printButton.title = '打印文档';

    document.body.appendChild(printButton);

    printButton.addEventListener('click', function() {
        window.print();
    });
}

// 初始化打印按钮
initPrintButton();

/**
 * 键盘快捷键
 */
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K: 聚焦搜索（如果实现了搜索）
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }

    // ESC: 关闭移动端菜单
    if (e.key === 'Escape') {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    }
});

/**
 * 导出功能供外部使用
 */
window.APIDocs = {
    copyCode: function(code) {
        return navigator.clipboard.writeText(code);
    },
    scrollToSection: function(sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    },
    highlightSection: function(sectionId) {
        const element = document.getElementById(sectionId);
        if (element) {
            element.style.animation = 'highlight 1s ease';
            setTimeout(() => {
                element.style.animation = '';
            }, 1000);
        }
    }
};

console.log('✅ API Documentation scripts loaded successfully!');
console.log('📚 Available functions: window.APIDocs');
