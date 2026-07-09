module.exports = {
  plugins: ["n8n-nodes-base"],
  extends: [
    "plugin:n8n-nodes-base/community",
    "plugin:n8n-nodes-base/credentials",
    "plugin:n8n-nodes-base/nodes",
  ],
  overrides: [
    {
      files: ["*.json"],
      parser: "jsonc-eslint-parser",
    },
    {
      files: ["*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        sourceType: "module",
      },
    },
  ],
  rules: {
    "n8n-nodes-base/cred-class-field-documentation-url-miscased": "off",
  },
};
