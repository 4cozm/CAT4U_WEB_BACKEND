document.addEventListener('DOMContentLoaded', () => {
    const createForm = document.getElementById('post-create-form');
    const imagePreview = document.getElementById('image-preview');
    const fileInput = document.getElementById('images');
    
    // 이미지 미리보기 기능
    fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                    <button type="button" class="remove-image">&times;</button>
                `;
                imagePreview.appendChild(previewItem);
                
                // 이미지 제거 버튼 기능
                previewItem.querySelector('.remove-image').addEventListener('click', () => {
                    previewItem.remove();
                });
            };
            reader.readAsDataURL(file);
        });
    });
    
    // 폼 제출 처리
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(createForm);
        const postData = {
            category: formData.get('category'),
            title: formData.get('title'),
            content: formData.get('content'),
            images: Array.from(fileInput.files),
            timestamp: new Date().toISOString()
        };
        
        // localStorage에 저장 (실제 구현에서는 서버로 전송)
        savePost(postData);
        
        // 메인 페이지 컨텐츠 업데이트
        updateMainContent(postData);
        
        // 폼 초기화
        createForm.reset();
        imagePreview.innerHTML = '';
        alert('게시글이 등록되었습니다.');
    });
});

// 게시글 저장 함수
function savePost(postData) {
    const posts = JSON.parse(localStorage.getItem('posts') || '[]');
    posts.push(postData);
    localStorage.setItem('posts', JSON.stringify(posts));
}

// 메인 페이지 컨텐츠 업데이트 함수
function updateMainContent(postData) {
    // 실시간 업데이트는 제거하고 저장만 수행
    alert('게시글이 등록되었습니다. 해당 페이지에서 확인하실 수 있습니다.');
}

// 게시글 요소 생성 함수
function createPostElement(postData) {
    const article = document.createElement('article');
    article.className = 'post';
    article.innerHTML = `
        <h3>${postData.title}</h3>
        <div class="post-content">${postData.content}</div>
        <div class="post-images">
            ${postData.images.map(image => `
                <img src="${URL.createObjectURL(image)}" alt="Post image">
            `).join('')}
        </div>
        <div class="post-date">${new Date(postData.timestamp).toLocaleDateString()}</div>
    `;
    return article;
} 