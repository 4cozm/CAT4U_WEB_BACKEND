document.addEventListener('DOMContentLoaded', () => {
    const postsContainer = document.querySelector('.posts-container');
    
    // 해당 카테고리의 게시글만 불러오기
    function loadCategoryPosts() {
        const posts = JSON.parse(localStorage.getItem('posts') || '[]');
        const guidePosts = posts.filter(post => post.category === 'guide');
        
        guidePosts.forEach(post => {
            const postElement = createPostElement(post);
            postsContainer.appendChild(postElement);
        });
    }
    
    loadCategoryPosts();
}); 