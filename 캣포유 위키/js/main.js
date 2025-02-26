document.addEventListener('DOMContentLoaded', () => {
    // 인증 체크
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    if (!isAuthenticated) {
        window.location.href = 'auth.html';
        return;
    }
    
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mainNav = document.querySelector('.main-nav');
    
    mobileMenuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
    });
    
    // 스크롤 시 헤더 스타일 변경
    window.addEventListener('scroll', () => {
        const header = document.querySelector('.main-header');
        if (window.scrollY > 50) {
            header.style.backgroundColor = 'rgba(26,26,26,0.9)';
        } else {
            header.style.backgroundColor = '#1a1a1a';
        }
    });
    
    // 저장된 게시글 불러오기
    loadPosts();

    // 사이드 메뉴 토글 기능
    const toggleBtn = document.querySelector('.toggle-menu');
    const sideMenu = document.querySelector('.side-menu');
    
    if (toggleBtn && sideMenu) {
        toggleBtn.addEventListener('click', () => {
            sideMenu.classList.toggle('collapsed');
            // 로컬 스토리지에 상태 저장
            localStorage.setItem('sideMenuCollapsed', sideMenu.classList.contains('collapsed'));
        });
        
        // 페이지 로드 시 이전 상태 복원
        const isCollapsed = localStorage.getItem('sideMenuCollapsed') === 'true';
        if (isCollapsed) {
            sideMenu.classList.add('collapsed');
        }
    }
});

// 저장된 게시글 불러오기 함수
function loadPosts() {
    const posts = JSON.parse(localStorage.getItem('posts') || '[]');
    
    posts.forEach(post => {
        const section = document.querySelector(`#${post.category}`);
        if (section) {
            const postElement = createPostElement(post);
            section.appendChild(postElement);
        }
    });
}

// 게시글 요소 생성 함수
function createPostElement(post) {
    const article = document.createElement('article');
    article.className = 'post';
    article.innerHTML = `
        <h3>${post.title}</h3>
        <div class="post-content">${post.content}</div>
        <div class="post-images">
            ${post.images ? post.images.map(image => `
                <img src="${image}" alt="Post image">
            `).join('') : ''}
        </div>
        <div class="post-date">${new Date(post.timestamp).toLocaleDateString()}</div>
    `;
    return article;
} 