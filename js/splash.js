document.addEventListener('DOMContentLoaded', () => {
    const letters = document.querySelectorAll('.letter');
    
    letters.forEach((letter, index) => {
        letter.style.animationDelay = `${(index + 1) * 0.2}s`;
    });

    setTimeout(() => {
        window.location.href = 'auth.html';
    }, 3000);
}); 