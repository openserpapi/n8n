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
    // Current n8n requires NodeConnectionTypes.Main; this older plugin expects strings.
    "n8n-nodes-base/node-class-description-inputs-wrong-regular-node": "off",
    "n8n-nodes-base/node-class-description-outputs-wrong": "off",
  },
};
