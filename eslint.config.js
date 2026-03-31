const config = require('@rubensworks/eslint-config');

module.exports = config([
  {
    files: [ '**/*.ts' ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: [ './tsconfig.eslint.json' ],
      },
    },
  },
  {
    // Override rules for TypeScript files
    files: [ '**/*.ts' ],
    rules: {
      // Allow UPPER_CASE for static class properties (constants) and object literal
      // properties that use JSON-LD keywords (e.g. @value, @language) or numeric keys
      'ts/naming-convention': [
        'error',
        {
          selector: 'default',
          format: [ 'camelCase' ],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'import',
          format: null,
        },
        {
          selector: 'variable',
          format: [ 'camelCase', 'UPPER_CASE' ],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid',
        },
        {
          selector: 'typeLike',
          format: [ 'PascalCase' ],
        },
        {
          selector: [ 'typeParameter' ],
          format: [ 'PascalCase' ],
          prefix: [ 'T' ],
        },
        {
          selector: 'interface',
          format: [ 'PascalCase' ],
          custom: {
            regex: '^I[A-Z]',
            match: true,
          },
        },
        {
          // Allow UPPER_CASE for static class properties used as constants
          selector: 'classProperty',
          format: [ 'camelCase', 'UPPER_CASE' ],
        },
        {
          // JSON-LD keywords and other spec-defined keys cannot follow camelCase
          selector: 'objectLiteralProperty',
          format: null,
        },
        {
          // Allow leading underscore for methods overriding Node.js internals (e.g. _transform)
          selector: 'classMethod',
          format: [ 'camelCase' ],
          leadingUnderscore: 'allow',
        },
        {
          // Allow leading underscore for unused parameters (required by unused-imports/no-unused-vars)
          selector: 'parameter',
          format: [ 'camelCase' ],
          leadingUnderscore: 'allow',
          trailingUnderscore: 'forbid',
        },
      ],
    },
  },
]);
