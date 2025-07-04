export default [
    {
        ignores: ['node_modules', 'dist', 'logs'], // ESLint 검사 제외 폴더
    },
    {
        files: ['**/*.{js,ts}'], // 검사할 파일 패턴
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                process: 'readonly',
                __dirname: 'readonly',
                fetch: 'readonly',
                console: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-undef': 'error',
            'no-console': 'off',
            eqeqeq: ['error', 'always'],
            curly: 'error',
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'arrow-parens': ['error', 'as-needed'],
            'prefer-const': 'error',
            'no-var': 'error',
            'comma-dangle': ['error', 'only-multiline'],
        },
    },
];
