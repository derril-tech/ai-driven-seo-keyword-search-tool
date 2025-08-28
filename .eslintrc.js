module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    extends: [
        'eslint:recommended',
        '@typescript-eslint/recommended',
        'prettier',
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint'],
    rules: {
        '@typescript-eslint/no-unused-vars': 'error',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-non-null-assertion': 'warn',
    },
    overrides: [
        {
            files: ['apps/frontend/**/*.{ts,tsx}'],
            extends: [
                'next/core-web-vitals',
                'prettier',
            ],
        },
        {
            files: ['apps/gateway/**/*.ts'],
            extends: [
                '@typescript-eslint/recommended',
                'prettier',
            ],
        },
    ],
};
