module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'prettier',
  ],
  rules: {
    // Prettier 集成
    'prettier/prettier': 'error',
    
    // TypeScript 规则
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'warn',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
      },
    ],
    
    // 通用规则
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'warn',
    'quote-props': ['warn', 'as-needed'],
    
    // 导入规则
    'sort-imports': [
      'warn',
      {
        ignoreCase: true,
        ignoreDeclarationSort: true,
      },
    ],
  },
  overrides: [
    // React Native 移动端配置
    {
      files: ['packages/mobile/**/*.{ts,tsx}'],
      env: {
        'react-native/react-native': true,
      },
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
      ],
      plugins: ['react', 'react-hooks', 'react-native'],
      settings: {
        react: {
          version: 'detect',
        },
      },
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
        'react/display-name': 'off',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'warn',
        'react-native/no-unused-styles': 'warn',
        'react-native/no-inline-styles': 'warn',
        'react-native/no-color-literals': 'warn',
      },
    },
    // 服务端配置
    {
      files: ['packages/server/**/*.{js,ts}'],
      env: {
        node: true,
      },
      rules: {
        'no-console': 'off', // 服务端允许 console
      },
    },
    // 测试文件配置
    {
      files: ['**/*.test.{js,ts,tsx}', '**/*.spec.{js,ts,tsx}'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
};