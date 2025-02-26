document.addEventListener('DOMContentLoaded', () => {
    const eveLoginBtn = document.querySelector('.eve-btn');
    const tempLoginBtn = document.getElementById('tempLoginBtn');
    
    eveLoginBtn.addEventListener('click', () => {
        // EVE Online OAuth2 인증 로직 구현
        // 실제 EVE Online API 엔드포인트로 리다이렉트
        alert('EVE Online 로그인 기능은 현재 개발 중입니다.');
    });

    tempLoginBtn.addEventListener('click', () => {
        // 실제 인증 로직은 나중에 구현
        localStorage.setItem('isAuthenticated', 'true');
        window.location.href = 'main.html';
    });
}); 